import { createHash, randomInt } from 'node:crypto';
import { HttpError } from '../http.js';

/**
 * Firestore data access. The browser never touches Firestore (the rules deny
 * all client access); only this server does, after checking permissions.
 *
 * Collections:
 *   users/{uid}                      { email, displayName, role: 'user'|'admin', disabled, createdAt }
 *   families/{id}                    { name, joinCode, createdAt }
 *   memberships/{familyId}_{uid}     { familyId, uid, status: 'pending'|'member', familyRole: 'member'|'manager', createdAt }
 *   rounds/{id}                      { familyId, name, stage, createdAt }
 *   presents/{id}                    { roundId, familyId, giverUid, receiverUid, name, description, cloakedName, guessUid, revealedAt, createdAt }
 *   rateLimits/{sha256(key)}         { count, windowStart }
 *   audit/{auto}                     { at, uid, action, target }
 *
 * @typedef {import('firebase-admin/firestore').Firestore} Firestore
 * @typedef {import('firebase-admin/firestore').Transaction} Transaction
 * @typedef {import('../game/rules.js').Present} Present
 * @typedef {import('../game/rules.js').Stage} Stage
 * @typedef {{ uid: string, email: string, displayName: string, role: 'user' | 'admin', disabled: boolean, createdAt: string }} User
 * @typedef {{ id: string, name: string, joinCode: string, createdAt: string }} Family
 * @typedef {{ familyId: string, uid: string, status: 'pending' | 'member', familyRole: 'member' | 'manager', createdAt: string }} Membership
 * @typedef {{ id: string, familyId: string, name: string, stage: Stage, createdAt: string }} Round
 */

// No 0/O or 1/I/L, so codes are easy to read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newJoinCode() {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

const now = () => new Date().toISOString();

/**
 * @template T
 * @param {import('firebase-admin/firestore').DocumentSnapshot} snap
 * @returns {T | null}
 */
function withId(snap) {
  return snap.exists ? /** @type {T} */ ({ id: snap.id, ...snap.data() }) : null;
}

/** @param {Firestore} db */
export function createStore(db) {
  const users = db.collection('users');
  const families = db.collection('families');
  const memberships = db.collection('memberships');
  const rounds = db.collection('rounds');
  const presents = db.collection('presents');

  /** @param {string} familyId @param {string} uid */
  const membershipRef = (familyId, uid) => memberships.doc(`${familyId}_${uid}`);

  /** Delete every document a query returns, in batches of 400. @param {import('firebase-admin/firestore').Query} query */
  async function deleteAll(query) {
    for (;;) {
      const snap = await query.limit(400).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  return {
    // ---- users ----

    /** @param {string} uid @returns {Promise<User | null>} */
    async getUser(uid) {
      const snap = await users.doc(uid).get();
      return snap.exists ? /** @type {User} */ ({ uid, ...snap.data() }) : null;
    },

    /**
     * Load the user's record, creating it on first sign-in.
     * @param {{ uid: string, email?: string, name?: string }} token
     * @returns {Promise<User>}
     */
    async ensureUser(token) {
      const ref = users.doc(token.uid);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return /** @type {User} */ ({ uid: token.uid, ...snap.data() });
        const email = token.email ?? '';
        const user = {
          email,
          displayName: (token.name || email.split('@')[0] || 'Elf').slice(0, 60),
          role: /** @type {const} */ ('user'),
          disabled: false,
          createdAt: now(),
        };
        tx.create(ref, user);
        return { uid: token.uid, ...user };
      });
    },

    /** @param {string} uid @param {Partial<Pick<User, 'displayName' | 'role' | 'disabled'>>} patch */
    async updateUser(uid, patch) {
      await users.doc(uid).update(patch);
    },

    /** @returns {Promise<User[]>} */
    async listUsers() {
      const snap = await users.orderBy('createdAt').get();
      return snap.docs.map((doc) => /** @type {User} */ ({ uid: doc.id, ...doc.data() }));
    },

    /** @param {string[]} uids @returns {Promise<Map<string, User>>} */
    async getUsers(uids) {
      if (uids.length === 0) return new Map();
      const snaps = await db.getAll(...uids.map((uid) => users.doc(uid)));
      return new Map(
        snaps.filter((s) => s.exists).map((s) => [s.id, /** @type {User} */ ({ uid: s.id, ...s.data() })]),
      );
    },

    // ---- families and memberships ----

    /** @param {string} name @returns {Promise<Family>} */
    async createFamily(name) {
      const ref = families.doc();
      const family = { name, joinCode: newJoinCode(), createdAt: now() };
      await ref.create(family);
      return { id: ref.id, ...family };
    },

    /** @param {string} id @returns {Promise<Family | null>} */
    async getFamily(id) {
      return withId(await families.doc(id).get());
    },

    /** @returns {Promise<Family[]>} */
    async listFamilies() {
      const snap = await families.orderBy('createdAt').get();
      return snap.docs.map((doc) => /** @type {Family} */ ({ id: doc.id, ...doc.data() }));
    },

    /** @param {string} code @returns {Promise<Family | null>} */
    async findFamilyByCode(code) {
      const snap = await families.where('joinCode', '==', code).limit(1).get();
      return snap.empty ? null : withId(snap.docs[0]);
    },

    /** @param {string} id @returns {Promise<string>} the new code */
    async rotateJoinCode(id) {
      const joinCode = newJoinCode();
      await families.doc(id).update({ joinCode });
      return joinCode;
    },

    /** Delete a family with its memberships, rounds and presents. @param {string} id */
    async deleteFamily(id) {
      await deleteAll(presents.where('familyId', '==', id));
      await deleteAll(rounds.where('familyId', '==', id));
      await deleteAll(memberships.where('familyId', '==', id));
      await families.doc(id).delete();
    },

    /** @param {string} familyId @param {string} uid @returns {Promise<Membership | null>} */
    async getMembership(familyId, uid) {
      const snap = await membershipRef(familyId, uid).get();
      return snap.exists ? /** @type {Membership} */ (snap.data()) : null;
    },

    /** @param {string} familyId @returns {Promise<Membership[]>} */
    async listMemberships(familyId) {
      const snap = await memberships.where('familyId', '==', familyId).get();
      return snap.docs.map((doc) => /** @type {Membership} */ (doc.data()));
    },

    /** @param {string} uid @returns {Promise<Membership[]>} */
    async listMembershipsForUser(uid) {
      const snap = await memberships.where('uid', '==', uid).get();
      return snap.docs.map((doc) => /** @type {Membership} */ (doc.data()));
    },

    /**
     * Ask to join. Does nothing if the user already has a membership.
     * @param {string} familyId @param {string} uid @returns {Promise<Membership>}
     */
    async requestMembership(familyId, uid) {
      const ref = membershipRef(familyId, uid);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return /** @type {Membership} */ (snap.data());
        /** @type {Membership} */
        const membership = { familyId, uid, status: 'pending', familyRole: 'member', createdAt: now() };
        tx.create(ref, membership);
        return membership;
      });
    },

    /** @param {string} familyId @param {string} uid @param {Partial<Pick<Membership, 'status' | 'familyRole'>>} patch */
    async updateMembership(familyId, uid, patch) {
      await membershipRef(familyId, uid).update(patch);
    },

    /**
     * Add someone directly (used by the migration and by admins).
     * @param {string} familyId @param {string} uid @param {'member' | 'manager'} familyRole
     */
    async addMember(familyId, uid, familyRole) {
      /** @type {Membership} */
      const membership = { familyId, uid, status: 'member', familyRole, createdAt: now() };
      await membershipRef(familyId, uid).set(membership);
      return membership;
    },

    /** @param {string} familyId @param {string} uid */
    async deleteMembership(familyId, uid) {
      await membershipRef(familyId, uid).delete();
    },

    // ---- rounds ----

    /** @param {string} familyId @param {string} name @returns {Promise<Round>} */
    async createRound(familyId, name) {
      const ref = rounds.doc();
      const round = { familyId, name, stage: /** @type {Stage} */ ('giving'), createdAt: now() };
      await ref.create(round);
      return { id: ref.id, ...round };
    },

    /** @param {string} id @returns {Promise<Round | null>} */
    async getRound(id) {
      return withId(await rounds.doc(id).get());
    },

    /** @param {string} familyId @returns {Promise<Round[]>} */
    async listRounds(familyId) {
      const snap = await rounds.where('familyId', '==', familyId).get();
      return snap.docs
        .map((doc) => /** @type {Round} */ ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    /**
     * Change the stage, checking the move inside the transaction.
     * @param {string} id
     * @param {(round: Round) => void} check throws to refuse
     * @param {Stage} stage
     */
    async setRoundStage(id, check, stage) {
      const ref = rounds.doc(id);
      return db.runTransaction(async (tx) => {
        const round = /** @type {Round | null} */ (withId(await tx.get(ref)));
        if (!round) throw new HttpError(404, 'That gift round no longer exists.');
        check(round);
        tx.update(ref, { stage });
        return { ...round, stage };
      });
    },

    /** @param {string} id */
    async deleteRound(id) {
      await deleteAll(presents.where('roundId', '==', id));
      await rounds.doc(id).delete();
    },

    // ---- presents ----

    /** @param {Omit<Present, 'id'>} present @returns {Promise<Present>} */
    async createPresent(present) {
      const ref = presents.doc();
      await ref.create({ ...present, createdAt: now() });
      return { id: ref.id, ...present };
    },

    /** @param {string} id @returns {Promise<Present | null>} */
    async getPresent(id) {
      return withId(await presents.doc(id).get());
    },

    /** @param {string} roundId @returns {Promise<Present[]>} */
    async listPresents(roundId) {
      const snap = await presents.where('roundId', '==', roundId).get();
      return snap.docs.map((doc) => /** @type {Present} */ ({ id: doc.id, ...doc.data() }));
    },

    /**
     * Read a present and its round in a transaction, let `decide` check the
     * rules against that consistent view, then apply the patch it returns.
     *
     * @param {string} id
     * @param {(present: Present, round: Round) => Partial<Present>} decide throws to refuse
     * @returns {Promise<{ present: Present, round: Round }>}
     */
    async updatePresent(id, decide) {
      const ref = presents.doc(id);
      return db.runTransaction(async (tx) => {
        const present = /** @type {Present | null} */ (withId(await tx.get(ref)));
        if (!present) throw new HttpError(404, 'That present no longer exists.');
        const round = /** @type {Round | null} */ (withId(await tx.get(rounds.doc(present.roundId))));
        if (!round) throw new HttpError(404, 'That gift round no longer exists.');
        const patch = decide(present, round);
        tx.update(ref, patch);
        return { present: { ...present, ...patch }, round };
      });
    },

    /** @param {string} id @param {(present: Present, round: Round) => void} check throws to refuse */
    async deletePresent(id, check) {
      const ref = presents.doc(id);
      await db.runTransaction(async (tx) => {
        const present = /** @type {Present | null} */ (withId(await tx.get(ref)));
        if (!present) throw new HttpError(404, 'That present no longer exists.');
        const round = /** @type {Round | null} */ (withId(await tx.get(rounds.doc(present.roundId))));
        if (!round) throw new HttpError(404, 'That gift round no longer exists.');
        check(present, round);
        tx.delete(ref);
      });
    },

    // ---- rate limits and audit ----

    /**
     * Count one use of `key`; refuse with 429 past `limit` uses per window.
     * Stored in Firestore so the limit holds across Cloud Run instances.
     *
     * @param {string} key @param {number} limit @param {number} windowMs
     */
    async consumeRateLimit(key, limit, windowMs) {
      const ref = db.collection('rateLimits').doc(createHash('sha256').update(key).digest('hex'));
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        const nowMs = Date.now();
        if (!data || nowMs - data.windowStart >= windowMs) {
          tx.set(ref, { count: 1, windowStart: nowMs });
          return;
        }
        if (data.count >= limit) throw new HttpError(429, 'Too many requests. Please wait a little and try again.');
        tx.update(ref, { count: data.count + 1 });
      });
    },

    /** @param {string} uid @param {string} action @param {Record<string, unknown>} target */
    async audit(uid, action, target) {
      await db.collection('audit').add({ at: now(), uid, action, target });
    },
  };
}

/** @typedef {ReturnType<typeof createStore>} Store */
