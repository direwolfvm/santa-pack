// Copy Santa Pack's users and game data from the self-hosted Supabase
// "project-b" database into Firebase Auth (the santa-pack tenant) and the
// santa-pack Firestore database.
//
//   SUPABASE_DB_URL=postgres://… node --env-file=.env scripts/migrate-from-supabase.mjs           # dry run
//   SUPABASE_DB_URL=postgres://… node --env-file=.env scripts/migrate-from-supabase.mjs --apply   # write
//
// - Reads Postgres in a read-only transaction; never writes to Supabase.
// - Users keep their Supabase id as their Firebase uid and their bcrypt
//   password hash, so they sign in with the same password. Confirmed emails
//   stay verified.
// - Firestore documents get deterministic ids (sb-<table>-<id>), so running it
//   again overwrites the same documents instead of duplicating them. Run it a
//   final time at cutover, after the old app stops taking writes.
// - Prints counts and anything it had to skip; never prints emails in full or
//   password hashes.
import pg from 'pg';
import { loadConfig } from '../server/config.js';
import { connectFirebase } from '../server/firebase/admin.js';

const apply = process.argv.includes('--apply');
const sourceUrl = process.env.SUPABASE_DB_URL;
if (!sourceUrl) {
  console.error('Set SUPABASE_DB_URL to the project-b Postgres URL (read from Secret Manager; never commit it).');
  process.exit(1);
}

/** @param {string | null | undefined} email */
const mask = (email) => (email ? `${email.slice(0, 2)}***@${email.split('@')[1] ?? ''}` : '(no email)');
/** @param {Date | string | null} value */
const iso = (value) => (value ? new Date(value).toISOString() : new Date().toISOString());

// ---- read ----

const client = new pg.Client({ connectionString: sourceUrl });
await client.connect();
await client.query('begin transaction read only');
/**
 * @typedef {{ id: string, email: string | null, encrypted_password: string | null, email_confirmed_at: Date | null, created_at: Date, last_sign_in_at: Date | null }} SbUser
 * @typedef {{ id: string, role: string | null }} SbProfile
 * @typedef {{ id: number, name: string, created_at: Date }} SbFamily
 * @typedef {{ id: number, name: string | null, user_profile: string | null, family: number | null, family_pending: number | null, created_at: Date }} SbPerson
 * @typedef {{ id: number, name: string, family: number, stage: string, created_at: Date }} SbRound
 * @typedef {{ id: number, name: string | null, description: string | null, cloaked_name: string | null, gift_round: number, giver: number, receiver: number, receiver_guess: number | null, revealed: boolean, created_at: Date }} SbPresent
 */
/** @template T @param {string} sql @returns {Promise<T[]>} */
const q = async (sql) => (await client.query(sql)).rows;
const source = {
  users: /** @type {SbUser[]} */ (
    await q(
      'select id, email, encrypted_password, email_confirmed_at, created_at, last_sign_in_at from auth.users order by created_at',
    )
  ),
  profiles: /** @type {SbProfile[]} */ (await q('select id, role from public.profiles')),
  families: /** @type {SbFamily[]} */ (await q('select id, name, created_at from public.family order by id')),
  people: /** @type {SbPerson[]} */ (
    await q('select id, name, user_profile, family, family_pending, created_at from public.person order by id')
  ),
  rounds: /** @type {SbRound[]} */ (
    await q('select id, name, family, stage, created_at from public.gift_round order by id')
  ),
  presents: /** @type {SbPresent[]} */ (
    await q(
      'select id, name, description, cloaked_name, gift_round, giver, receiver, receiver_guess, revealed, created_at from public.present order by id',
    )
  ),
};
await client.query('rollback');
await client.end();

// ---- transform ----

/** @type {string[]} */
const skipped = [];
const userIds = new Set(source.users.map((u) => u.id));
const roleOf = new Map(source.profiles.map((p) => [p.id, p.role]));
const familyIds = new Set(source.families.map((f) => String(f.id)));

/**
 * Person id -> player id. People with an account use their uid. People
 * without one (the old app let organizers play for them) become guest players
 * with id "guest-sb-<person id>".
 * @type {Map<string, string>}
 */
const uidOfPerson = new Map();
const guestPeople = new Set();
for (const person of source.people) {
  if (person.user_profile && userIds.has(person.user_profile)) {
    uidOfPerson.set(String(person.id), person.user_profile);
  } else if (!person.user_profile && person.family !== null) {
    uidOfPerson.set(String(person.id), `guest-sb-${person.id}`);
    guestPeople.add(String(person.id));
  } else {
    skipped.push(`person ${person.id}: account missing or no family`);
  }
}

/** The display name: the person's name, else the email's local part. */
/** @type {Map<string, string>} */
const displayNameOf = new Map();
for (const person of source.people) {
  if (person.user_profile && person.name?.trim() && !displayNameOf.has(person.user_profile)) {
    displayNameOf.set(person.user_profile, person.name.trim().slice(0, 60));
  }
}

const familyDoc = (/** @type {string | number} */ id) => `sb-family-${id}`;
const roundDoc = (/** @type {string | number} */ id) => `sb-round-${id}`;

// A short random code is generated per family, as new families get.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = () =>
  Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

const plan = {
  users: source.users.map((u) => ({
    uid: u.id,
    email: u.email,
    emailVerified: Boolean(u.email_confirmed_at),
    passwordHash: u.encrypted_password ? Buffer.from(u.encrypted_password) : undefined,
    displayName: displayNameOf.get(u.id) ?? (u.email ?? 'Elf').split('@')[0],
    role: roleOf.get(u.id) === 'admin' ? 'admin' : 'user',
    createdAt: iso(u.created_at),
  })),
  families: source.families.map((f) => ({
    id: familyDoc(f.id),
    data: { name: f.name, joinCode: code(), createdAt: iso(f.created_at) },
  })),
  memberships: /** @type {{ id: string, data: Record<string, unknown> }[]} */ ([]),
  rounds: /** @type {{ id: string, data: Record<string, unknown> }[]} */ ([]),
  presents: /** @type {{ id: string, data: Record<string, unknown> }[]} */ ([]),
};

for (const person of source.people) {
  const uid = uidOfPerson.get(String(person.id));
  if (!uid) continue;
  const isGuest = guestPeople.has(String(person.id));
  /** @type {Array<[number | null, 'member' | 'pending']>} */
  const links = [
    [person.family, 'member'],
    [isGuest ? null : person.family_pending, 'pending'],
  ];
  for (const [familyId, status] of links) {
    if (familyId === null) continue;
    if (!familyIds.has(String(familyId))) {
      skipped.push(`person ${person.id}: family ${familyId} does not exist`);
      continue;
    }
    plan.memberships.push({
      id: `${familyDoc(familyId)}_${uid}`,
      data: {
        familyId: familyDoc(familyId),
        uid,
        status,
        // Supabase "manager" was site-wide; it becomes manager of each family they were in.
        familyRole: roleOf.get(uid) === 'manager' && status === 'member' ? 'manager' : 'member',
        createdAt: iso(person.created_at),
        ...(isGuest ? { kind: 'guest', displayName: (person.name ?? '').trim().slice(0, 60) || 'Guest' } : {}),
      },
    });
  }
}

const stageOf = new Map();
for (const round of source.rounds) {
  if (!familyIds.has(String(round.family))) {
    skipped.push(`round ${round.id}: family ${round.family} does not exist`);
    continue;
  }
  const stage = ['giving', 'guessing', 'complete'].includes(round.stage) ? round.stage : 'giving';
  if (stage !== round.stage) skipped.push(`round ${round.id}: unknown stage "${round.stage}", set to giving`);
  stageOf.set(String(round.id), { familyId: familyDoc(round.family) });
  plan.rounds.push({
    id: roundDoc(round.id),
    data: { familyId: familyDoc(round.family), name: round.name, stage, createdAt: iso(round.created_at) },
  });
}

for (const present of source.presents) {
  const round = stageOf.get(String(present.gift_round));
  const giverUid = uidOfPerson.get(String(present.giver));
  const receiverUid = uidOfPerson.get(String(present.receiver));
  if (!round || !giverUid || !receiverUid) {
    skipped.push(`present ${present.id}: missing round, giver or receiver`);
    continue;
  }
  plan.presents.push({
    id: `sb-present-${present.id}`,
    data: {
      roundId: roundDoc(present.gift_round),
      familyId: round.familyId,
      giverUid,
      receiverUid,
      name: present.name ?? '',
      description: present.description ?? '',
      cloakedName: present.cloaked_name ?? '',
      guessUid: present.receiver_guess === null ? null : (uidOfPerson.get(String(present.receiver_guess)) ?? null),
      revealedAt: present.revealed ? iso(present.created_at) : null,
      createdAt: iso(present.created_at),
    },
  });
}

// ---- report ----

console.log(
  `Source: ${source.users.length} accounts, ${source.families.length} families, ${source.people.length} people, ${source.rounds.length} rounds, ${source.presents.length} presents`,
);
console.log(
  `Target: ${plan.users.length} accounts, ${plan.families.length} families, ${plan.memberships.length} memberships, ${plan.rounds.length} rounds, ${plan.presents.length} presents`,
);
for (const u of plan.users) {
  const families = plan.memberships.filter((m) => m.data.uid === u.uid);
  console.log(
    `  ${mask(u.email)}  role=${u.role}  verified=${u.emailVerified}  password=${u.passwordHash ? 'kept' : 'none (must reset)'}  ` +
      `families=${families.map((m) => `${m.data.familyId}:${m.data.status}/${m.data.familyRole}`).join(',') || '-'}`,
  );
}
const guestCount = plan.memberships.filter((m) => m.data.kind === 'guest').length;
console.log(`  players without an account (become guests): ${guestCount}`);
if (skipped.length) console.log(`Skipped or adjusted:\n  ${skipped.join('\n  ')}`);

if (!apply) {
  console.log('\nDry run. Nothing was written. Pass --apply to write to Firebase.');
  process.exit(0);
}

// ---- write ----

const config = loadConfig({ ...process.env, BACKEND: 'firebase' });
if (config.backend !== 'firebase') throw new Error('unreachable');
const { db, auth } = connectFirebase(config);
console.log(`\nWriting to project ${config.projectId}, tenant ${config.tenantId}, database ${config.databaseId}…`);

const withHash = plan.users.filter((u) => u.passwordHash);
const result = await auth.importUsers(
  plan.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? undefined,
    emailVerified: u.emailVerified,
    displayName: u.displayName,
    ...(u.passwordHash ? { passwordHash: u.passwordHash } : {}),
  })),
  withHash.length ? { hash: { algorithm: 'BCRYPT' } } : undefined,
);
console.log(`Accounts imported: ${result.successCount}, failed: ${result.failureCount}`);
for (const error of result.errors) console.log(`  account #${error.index}: ${error.error.message}`);
if (result.failureCount) process.exit(1);

/** @type {Array<[string, string, Record<string, unknown>]>} */
const writes = [
  ...plan.users.map(
    (u) =>
      /** @type {[string, string, Record<string, unknown>]} */ ([
        'users',
        u.uid,
        { email: u.email, displayName: u.displayName, role: u.role, disabled: false, createdAt: u.createdAt },
      ]),
  ),
  ...plan.families.map((f) => /** @type {[string, string, Record<string, unknown>]} */ (['families', f.id, f.data])),
  ...plan.memberships.map(
    (m) => /** @type {[string, string, Record<string, unknown>]} */ (['memberships', m.id, m.data]),
  ),
  ...plan.rounds.map((r) => /** @type {[string, string, Record<string, unknown>]} */ (['rounds', r.id, r.data])),
  ...plan.presents.map((p) => /** @type {[string, string, Record<string, unknown>]} */ (['presents', p.id, p.data])),
];
for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  for (const [collection, id, data] of writes.slice(i, i + 400)) batch.set(db.collection(collection).doc(id), data);
  await batch.commit();
}
await db.collection('audit').add({
  at: new Date().toISOString(),
  uid: 'migrate-from-supabase',
  action: 'migration.apply',
  target: { documents: writes.length, accounts: result.successCount },
});
console.log(`Firestore documents written: ${writes.length}`);
