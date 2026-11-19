import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Connect to Firebase with Application Default Credentials (the Cloud Run
 * runtime service account in production). When FIRESTORE_EMULATOR_HOST,
 * FIREBASE_AUTH_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST are set, the
 * SDK talks to the local emulators.
 *
 * @param {{ projectId: string, databaseId: string, tenantId: string, photosBucket: string }} config
 */
export function connectFirebase({ projectId, databaseId, tenantId, photosBucket }) {
  const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const app = initializeApp(
    usingEmulators ? { projectId } : { projectId, credential: applicationDefault() },
    `santa-pack-${databaseId}-${tenantId}`,
  );
  const db = getFirestore(app, databaseId);
  const auth = getAuth(app).tenantManager().authForTenant(tenantId);
  const bucket = getStorage(app).bucket(photosBucket);
  return { db, auth, bucket };
}
