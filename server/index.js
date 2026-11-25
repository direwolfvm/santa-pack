import { loadConfig } from './config.js';
import { connectFirebase } from './firebase/admin.js';
import createFirebaseApp from './firebase/app.js';
import { createFramblywish } from './firebase/framblywish.js';
import { logSender, mailgunSender } from './firebase/mail.js';
import { createPhotoStore } from './firebase/photos.js';
import { createSigninMail } from './firebase/signin-mail.js';
import { createStore } from './firebase/store.js';

let config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(/** @type {Error} */ (error).message, '(see .env.example)');
  process.exit(1);
}

const { db, auth, bucket } = connectFirebase(config);
// Mailgun when configured; on the emulators, emails go to the log instead.
const send = config.mailgun
  ? mailgunSender(config.mailgun)
  : process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? logSender
    : undefined;
const app = createFirebaseApp({
  store: createStore(db),
  photos: createPhotoStore(bucket),
  framblywish: config.framblywishUrl ? createFramblywish({ baseUrl: config.framblywishUrl }) : undefined,
  auth,
  webConfig: config.webConfig,
  allowedOrigins: config.allowedOrigins,
  mail: send ? createSigninMail({ auth, send, baseUrl: config.baseUrl }) : undefined,
});

const server = app.listen(config.port, () => {
  console.log(`Santa Pack is ready at http://localhost:${config.port}`);
});

// Cloud Run sends SIGTERM before stopping an instance.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
