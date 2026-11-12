import { Router } from 'express';
import { z } from 'zod';

const HOUR = 60 * 60 * 1000;
const emailBody = z.object({ email: z.email().max(254).toLowerCase() });

/**
 * Routes that send the sign-in emails. They sit outside requireUser: a reset
 * has no session, and a confirmation is asked for by someone not yet confirmed.
 *
 * @param {{
 *   store: import('./store.js').Store,
 *   mail: import('./signin-mail.js').SigninMail,
 *   verifiedToken: (req: import('express').Request) => Promise<import('firebase-admin/auth').DecodedIdToken>,
 * }} deps
 */
export function createAuthMailApi({ store, mail, verifiedToken }) {
  const api = Router();

  api.post('/auth/reset', async (req, res) => {
    const { email } = emailBody.parse(req.body);
    await store.consumeRateLimit(`reset-ip:${req.ip}`, 20, HOUR);
    await store.consumeRateLimit(`reset:${email}`, 5, HOUR);
    try {
      await mail.passwordReset(email);
    } catch (error) {
      // Same answer either way, so the reply never says whether an account exists.
      console.error('Password reset email failed:', /** @type {Error} */ (error)?.message);
    }
    res.json({ ok: true });
  });

  api.post('/auth/verify', async (req, res) => {
    const token = await verifiedToken(req);
    if (token.email_verified || !token.email) {
      res.json({ ok: true });
      return;
    }
    await store.consumeRateLimit(`verify:${token.uid}`, 6, HOUR);
    await mail.verification(token.email, typeof token.name === 'string' ? token.name : '');
    res.json({ ok: true });
  });

  return api;
}
