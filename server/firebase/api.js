import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../http.js';
import { canMoveStage, presentActionError, projectPresent, roundProgress, STAGES } from '../game/rules.js';
import { currentUser } from './auth.js';

/**
 * @typedef {import('./store.js').Store} Store
 * @typedef {import('./store.js').User} User
 * @typedef {import('./store.js').Membership} Membership
 * @typedef {import('express').Response} Response
 */

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^/]+$/);
const name = z.string().trim().min(1, 'Required').max(120);
const longText = z.string().trim().max(2000);

const schemas = {
  displayName: z.object({ displayName: z.string().trim().min(1).max(60) }),
  joinCode: z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{8}$/, 'Join codes are 8 letters and numbers.'),
  }),
  name: z.object({ name }),
  familyRole: z.object({ familyRole: z.enum(['member', 'manager']) }),
  stage: z.object({ stage: z.enum(STAGES) }),
  newPresent: z.object({
    receiverUid: id,
    name,
    description: longText.default(''),
    cloakedName: z.string().trim().max(120).default(''),
  }),
  presentEdit: z
    .object({ name, description: longText, cloakedName: z.string().trim().max(120) })
    .partial()
    .refine((value) => Object.keys(value).length > 0, 'Nothing to change.'),
  guess: z.object({ guessUid: id.nullable() }),
  adminUser: z
    .object({ role: z.enum(['user', 'admin']), disabled: z.boolean() })
    .partial()
    .refine((value) => Object.keys(value).length > 0, 'Nothing to change.'),
  addMember: z.object({ uid: id, familyRole: z.enum(['member', 'manager']).default('member') }),
};

/** @param {import('express').Request} req @param {string} key */
const param = (req, key) => id.parse(req.params[key]);

/** @param {Response} res */
const viewerOf = (res) => {
  const user = currentUser(res);
  return { uid: user.uid, isAdmin: user.role === 'admin' };
};

/**
 * The API for the Firebase backend. Every route requires a signed-in user.
 *
 * @param {{ store: Store, requireUser: import('express').RequestHandler, requireAdmin: import('express').RequestHandler }} deps
 */
export function createApi({ store, requireUser, requireAdmin }) {
  const api = Router();

  /**
   * Load a family the user belongs to. Non-members get 404 so family ids
   * can't be probed. Site admins count as managers of every family.
   *
   * @param {string} familyId @param {User} user @param {{ manager?: boolean }} [need]
   */
  async function familyAccess(familyId, user, need = {}) {
    const [family, membership] = await Promise.all([
      store.getFamily(familyId),
      store.getMembership(familyId, user.uid),
    ]);
    const isAdmin = user.role === 'admin';
    if (!family || (!isAdmin && membership?.status !== 'member')) {
      throw new HttpError(404, 'That family was not found.');
    }
    const isManager = isAdmin || membership?.familyRole === 'manager';
    if (need.manager && !isManager) throw new HttpError(403, 'Only family managers can do that.');
    return { family, membership, isManager };
  }

  /** @param {string} roundId @param {User} user @param {{ manager?: boolean }} [need] */
  async function roundAccess(roundId, user, need = {}) {
    const round = await store.getRound(roundId);
    if (!round) throw new HttpError(404, 'That gift round was not found.');
    const access = await familyAccess(round.familyId, user, need);
    return { round, ...access };
  }

  /** Members' public profiles. @param {Membership[]} list */
  async function describeMembers(list) {
    const users = await store.getUsers(list.map((m) => m.uid));
    return list.map((m) => ({
      uid: m.uid,
      displayName: users.get(m.uid)?.displayName ?? 'Former elf',
      familyRole: m.familyRole,
      status: m.status,
    }));
  }

  api.use(requireUser);

  // Durable per-user write limit, shared across Cloud Run instances.
  api.use(async (req, res, next) => {
    if (req.method !== 'GET') await store.consumeRateLimit(`write:${currentUser(res).uid}`, 120, 60_000);
    next();
  });

  // ---- me ----

  api.get('/me', async (_req, res) => {
    const user = currentUser(res);
    const memberships = await store.listMembershipsForUser(user.uid);
    const families = await Promise.all(
      memberships.map(async (m) => ({
        id: m.familyId,
        name: (await store.getFamily(m.familyId))?.name ?? '',
        status: m.status,
        familyRole: m.familyRole,
      })),
    );
    res.json({
      user: { uid: user.uid, email: user.email, displayName: user.displayName, role: user.role },
      families: families.filter((f) => f.name),
    });
  });

  api.patch('/me', async (req, res) => {
    const { displayName } = schemas.displayName.parse(req.body);
    await store.updateUser(currentUser(res).uid, { displayName });
    res.json({ displayName });
  });

  // ---- families ----

  api.post('/families/join', async (req, res) => {
    const user = currentUser(res);
    await store.consumeRateLimit(`join:${user.uid}`, 10, 60 * 60_000);
    const { code } = schemas.joinCode.parse(req.body);
    const family = await store.findFamilyByCode(code);
    if (!family) throw new HttpError(404, 'No family has that join code.');
    const membership = await store.requestMembership(family.id, user.uid);
    res.status(201).json({ family: { id: family.id, name: family.name }, status: membership.status });
  });

  api.get('/families/:familyId', async (req, res) => {
    const { family, isManager, membership } = await familyAccess(param(req, 'familyId'), currentUser(res));
    const [all, rounds] = await Promise.all([store.listMemberships(family.id), store.listRounds(family.id)]);
    const people = await describeMembers(all);
    res.json({
      family: { id: family.id, name: family.name, ...(isManager ? { joinCode: family.joinCode } : {}) },
      me: { isManager, familyRole: membership?.familyRole ?? null },
      members: people.filter((p) => p.status === 'member'),
      pending: isManager ? people.filter((p) => p.status === 'pending') : [],
      rounds: rounds.map((r) => ({ id: r.id, name: r.name, stage: r.stage, createdAt: r.createdAt })),
    });
  });

  api.post('/families', requireAdmin, async (req, res) => {
    const { name: familyName } = schemas.name.parse(req.body);
    const family = await store.createFamily(familyName);
    await store.audit(currentUser(res).uid, 'family.create', { familyId: family.id });
    res.status(201).json(family);
  });

  api.delete('/families/:familyId', requireAdmin, async (req, res) => {
    const familyId = param(req, 'familyId');
    await store.deleteFamily(familyId);
    await store.audit(currentUser(res).uid, 'family.delete', { familyId });
    res.status(204).end();
  });

  api.post('/families/:familyId/join-code', async (req, res) => {
    const { family } = await familyAccess(param(req, 'familyId'), currentUser(res), { manager: true });
    res.json({ joinCode: await store.rotateJoinCode(family.id) });
  });

  api.post('/families/:familyId/members/:uid/approve', async (req, res) => {
    const { family } = await familyAccess(param(req, 'familyId'), currentUser(res), { manager: true });
    const uid = param(req, 'uid');
    const membership = await store.getMembership(family.id, uid);
    if (membership?.status !== 'pending') throw new HttpError(404, 'There is no request to approve.');
    await store.updateMembership(family.id, uid, { status: 'member' });
    await store.audit(currentUser(res).uid, 'member.approve', { familyId: family.id, uid });
    res.json({ status: 'member' });
  });

  api.patch('/families/:familyId/members/:uid', async (req, res) => {
    const { family } = await familyAccess(param(req, 'familyId'), currentUser(res), { manager: true });
    const uid = param(req, 'uid');
    const { familyRole } = schemas.familyRole.parse(req.body);
    if ((await store.getMembership(family.id, uid))?.status !== 'member') {
      throw new HttpError(404, 'That person is not in this family.');
    }
    await store.updateMembership(family.id, uid, { familyRole });
    await store.audit(currentUser(res).uid, 'member.role', { familyId: family.id, uid, familyRole });
    res.json({ familyRole });
  });

  // Managers remove anyone; anyone can leave (or withdraw a request) themselves.
  api.delete('/families/:familyId/members/:uid', async (req, res) => {
    const user = currentUser(res);
    const familyId = param(req, 'familyId');
    const uid = param(req, 'uid');
    if (uid !== user.uid) await familyAccess(familyId, user, { manager: true });
    if (!(await store.getMembership(familyId, uid))) throw new HttpError(404, 'That person is not in this family.');
    await store.deleteMembership(familyId, uid);
    await store.audit(user.uid, 'member.remove', { familyId, uid });
    res.status(204).end();
  });

  // ---- rounds ----

  api.post('/families/:familyId/rounds', async (req, res) => {
    const { family } = await familyAccess(param(req, 'familyId'), currentUser(res), { manager: true });
    const { name: roundName } = schemas.name.parse(req.body);
    res.status(201).json(await store.createRound(family.id, roundName));
  });

  api.get('/rounds/:roundId', async (req, res) => {
    const viewer = viewerOf(res);
    const { round, family, isManager } = await roundAccess(param(req, 'roundId'), currentUser(res));
    const [presents, memberships] = await Promise.all([store.listPresents(round.id), store.listMemberships(family.id)]);
    const members = (await describeMembers(memberships)).filter((m) => m.status === 'member');
    res.json({
      round: { id: round.id, familyId: family.id, familyName: family.name, name: round.name, stage: round.stage },
      me: { uid: viewer.uid, isManager },
      members,
      presents: presents.map((p) => projectPresent(p, round.stage, viewer)).filter(Boolean),
      progress: roundProgress(
        presents,
        members.map((m) => m.uid),
        round.stage,
      ),
    });
  });

  api.patch('/rounds/:roundId', async (req, res) => {
    const { round } = await roundAccess(param(req, 'roundId'), currentUser(res), { manager: true });
    const { stage } = schemas.stage.parse(req.body);
    const updated = await store.setRoundStage(
      round.id,
      (current) => {
        if (!canMoveStage(current.stage, stage)) {
          throw new HttpError(409, `A round can't go from ${current.stage} to ${stage}.`);
        }
      },
      stage,
    );
    await store.audit(currentUser(res).uid, 'round.stage', { roundId: round.id, from: round.stage, to: stage });
    res.json(updated);
  });

  api.delete('/rounds/:roundId', requireAdmin, async (req, res) => {
    const roundId = param(req, 'roundId');
    await store.deleteRound(roundId);
    await store.audit(currentUser(res).uid, 'round.delete', { roundId });
    res.status(204).end();
  });

  // ---- presents ----

  api.post('/rounds/:roundId/presents', async (req, res) => {
    const user = currentUser(res);
    const { round, family } = await roundAccess(param(req, 'roundId'), user);
    if (round.stage !== 'giving') throw new HttpError(409, 'Presents can only be added while the round is giving.');
    const input = schemas.newPresent.parse(req.body);
    if (input.receiverUid === user.uid) throw new HttpError(400, "You can't give a present to yourself.");
    if ((await store.getMembership(family.id, input.receiverUid))?.status !== 'member') {
      throw new HttpError(400, 'The receiver must be in this family.');
    }
    const present = await store.createPresent({
      roundId: round.id,
      familyId: family.id,
      giverUid: user.uid,
      receiverUid: input.receiverUid,
      name: input.name,
      description: input.description,
      cloakedName: input.cloakedName,
      guessUid: null,
      revealedAt: null,
    });
    res.status(201).json(projectPresent(present, round.stage, viewerOf(res)));
  });

  /**
   * Shared path for present updates: the caller must still be in the family,
   * and the rules are checked inside the transaction.
   *
   * @param {Response} res
   * @param {string} presentId
   * @param {'edit' | 'guess' | 'reveal'} action
   * @param {(present: import('../game/rules.js').Present) => Partial<import('../game/rules.js').Present>} patch
   */
  async function changePresent(res, presentId, action, patch) {
    const viewer = viewerOf(res);
    const existing = await store.getPresent(presentId);
    if (!existing) throw new HttpError(404, 'That present was not found.');
    await familyAccess(existing.familyId, currentUser(res));
    const { present, round } = await store.updatePresent(presentId, (current, currentRound) => {
      const refusal = presentActionError(action, current, currentRound.stage, viewer);
      if (refusal) throw new HttpError(403, refusal);
      return patch(current);
    });
    res.json(projectPresent(present, round.stage, viewer));
  }

  api.patch('/presents/:presentId', async (req, res) => {
    const edit = schemas.presentEdit.parse(req.body);
    await changePresent(res, param(req, 'presentId'), 'edit', () => edit);
  });

  api.put('/presents/:presentId/guess', async (req, res) => {
    const { guessUid } = schemas.guess.parse(req.body);
    const presentId = param(req, 'presentId');
    const present = await store.getPresent(presentId);
    if (!present) throw new HttpError(404, 'That present was not found.');
    if (guessUid !== null) {
      if (guessUid === currentUser(res).uid) throw new HttpError(400, "You can't guess yourself.");
      if ((await store.getMembership(present.familyId, guessUid))?.status !== 'member') {
        throw new HttpError(400, 'Guess someone in this family.');
      }
    }
    await store.consumeRateLimit(`guess:${currentUser(res).uid}`, 60, 60 * 60_000);
    await changePresent(res, presentId, 'guess', () => ({ guessUid }));
  });

  api.post('/presents/:presentId/reveal', async (req, res) => {
    await changePresent(res, param(req, 'presentId'), 'reveal', (present) => ({
      revealedAt: present.revealedAt ?? new Date().toISOString(),
    }));
  });

  api.delete('/presents/:presentId', async (req, res) => {
    const viewer = viewerOf(res);
    const presentId = param(req, 'presentId');
    const existing = await store.getPresent(presentId);
    if (!existing) throw new HttpError(404, 'That present was not found.');
    if (!viewer.isAdmin) await familyAccess(existing.familyId, currentUser(res));
    await store.deletePresent(presentId, (present, round) => {
      const refusal = presentActionError('delete', present, round.stage, viewer);
      if (refusal) throw new HttpError(403, refusal);
    });
    res.status(204).end();
  });

  // ---- site admin ----

  api.get('/admin/users', requireAdmin, async (_req, res) => {
    const users = await store.listUsers();
    res.json(
      users.map(({ uid, email, displayName, role, disabled, createdAt }) => ({
        uid,
        email,
        displayName,
        role,
        disabled,
        createdAt,
      })),
    );
  });

  api.patch('/admin/users/:uid', requireAdmin, async (req, res) => {
    const uid = param(req, 'uid');
    const patch = schemas.adminUser.parse(req.body);
    if (uid === currentUser(res).uid)
      throw new HttpError(400, "You can't change your own role or turn off your own account.");
    if (!(await store.getUser(uid))) throw new HttpError(404, 'That user was not found.');
    await store.updateUser(uid, patch);
    await store.audit(currentUser(res).uid, 'user.update', { uid, ...patch });
    res.json({ uid, ...patch });
  });

  api.get('/admin/families', requireAdmin, async (_req, res) => {
    const families = await store.listFamilies();
    res.json(
      await Promise.all(
        families.map(async (f) => {
          const [memberships, rounds] = await Promise.all([store.listMemberships(f.id), store.listRounds(f.id)]);
          return {
            id: f.id,
            name: f.name,
            joinCode: f.joinCode,
            members: memberships.filter((m) => m.status === 'member').length,
            pending: memberships.filter((m) => m.status === 'pending').length,
            rounds: rounds.length,
          };
        }),
      ),
    );
  });

  api.post('/admin/families/:familyId/members', requireAdmin, async (req, res) => {
    const familyId = param(req, 'familyId');
    const { uid, familyRole } = schemas.addMember.parse(req.body);
    if (!(await store.getFamily(familyId))) throw new HttpError(404, 'That family was not found.');
    if (!(await store.getUser(uid))) throw new HttpError(404, 'That user was not found.');
    const membership = await store.addMember(familyId, uid, familyRole);
    await store.audit(currentUser(res).uid, 'member.add', { familyId, uid, familyRole });
    res.status(201).json(membership);
  });

  api.use(() => {
    throw new HttpError(404, 'Not found.');
  });

  return api;
}
