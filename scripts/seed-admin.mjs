// Make an existing Santa Pack account a site administrator.
//
//   node --env-file=.env scripts/seed-admin.mjs someone@example.com
//
// The person must have signed in once (so their user record exists). The
// script is idempotent, and is the only way to create the first admin:
// sign-up never grants admin.
import { loadConfig } from '../server/config.js';
import { connectFirebase } from '../server/firebase/admin.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/seed-admin.mjs <email>');
  process.exit(1);
}

const config = loadConfig({ ...process.env, BACKEND: 'firebase' });
if (config.backend !== 'firebase') throw new Error('unreachable');
const { db, auth } = connectFirebase(config);

const account = await auth.getUserByEmail(email).catch(() => null);
if (!account) {
  console.error(`No account for ${email} in tenant ${config.tenantId}. Ask them to sign up first.`);
  process.exit(1);
}
const ref = db.collection('users').doc(account.uid);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`${email} has an account but has not opened Santa Pack yet. Ask them to sign in once.`);
  process.exit(1);
}
if (snap.get('role') === 'admin') {
  console.log(`${email} is already an admin.`);
} else {
  await ref.update({ role: 'admin' });
  await db.collection('audit').add({
    at: new Date().toISOString(),
    uid: 'seed-admin',
    action: 'user.update',
    target: { uid: account.uid, role: 'admin' },
  });
  console.log(`${email} is now an admin.`);
}
