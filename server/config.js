import { z } from 'zod';

const supabaseEnv = z.object({
  BACKEND: z.literal('supabase').default('supabase'),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
});

const firebaseEnv = z.object({
  BACKEND: z.literal('firebase'),
  GOOGLE_CLOUD_PROJECT: z.string().min(1),
  FIRESTORE_DATABASE: z.string().min(1),
  FIREBASE_TENANT_ID: z.string().min(1),
  FIREBASE_API_KEY: z.string().min(1),
  FIREBASE_AUTH_DOMAIN: z.string().min(1),
  APP_BASE_URL: z.url(),
  // Comma-separated extra origins allowed to send writes (for example the run.app URL).
  APP_ADDITIONAL_ORIGINS: z.string().default(''),
  // Sign-in emails through Mailgun (server/firebase/signin-mail.js). All three
  // or none: without them the browser asks Google's sign-in service instead.
  MAILGUN_API_KEY: z.string().min(1).optional(),
  MAILGUN_DOMAIN: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).optional(),
  MAILGUN_API_BASE_URL: z.url().default('https://api.mailgun.net'),
  MAILGUN_TEST_MODE: z.enum(['true', 'false']).default('false'),
});

/**
 * Read and check the environment. BACKEND chooses the app: 'supabase' (today's
 * production, the default) or 'firebase' (the overhaul; see docs/overhaul-plan.md).
 *
 * @param {NodeJS.ProcessEnv} env
 */
export function loadConfig(env) {
  const port = Number.parseInt(env.PORT ?? '', 10) || 8080;
  if (env.BACKEND === 'firebase') {
    const parsed = firebaseEnv.safeParse(env);
    if (!parsed.success) throw new Error(`Missing or invalid settings: ${describe(parsed.error)}`);
    const c = parsed.data;
    const mailSettings = [c.MAILGUN_API_KEY, c.MAILGUN_DOMAIN, c.MAIL_FROM];
    if (mailSettings.some(Boolean) && !mailSettings.every(Boolean)) {
      throw new Error(
        'Missing or invalid settings: set all of MAILGUN_API_KEY, MAILGUN_DOMAIN and MAIL_FROM, or none.',
      );
    }
    return {
      backend: /** @type {const} */ ('firebase'),
      port,
      projectId: c.GOOGLE_CLOUD_PROJECT,
      databaseId: c.FIRESTORE_DATABASE,
      tenantId: c.FIREBASE_TENANT_ID,
      webConfig: {
        apiKey: c.FIREBASE_API_KEY,
        authDomain: c.FIREBASE_AUTH_DOMAIN,
        projectId: c.GOOGLE_CLOUD_PROJECT,
        tenantId: c.FIREBASE_TENANT_ID,
      },
      baseUrl: new URL(c.APP_BASE_URL).origin,
      allowedOrigins: [c.APP_BASE_URL, ...c.APP_ADDITIONAL_ORIGINS.split(',').filter(Boolean)],
      mailgun:
        c.MAILGUN_API_KEY && c.MAILGUN_DOMAIN && c.MAIL_FROM
          ? {
              apiKey: c.MAILGUN_API_KEY,
              domain: c.MAILGUN_DOMAIN,
              from: c.MAIL_FROM,
              apiBase: c.MAILGUN_API_BASE_URL,
              testMode: c.MAILGUN_TEST_MODE === 'true',
            }
          : null,
    };
  }
  const parsed = supabaseEnv.safeParse(env);
  if (!parsed.success) throw new Error(`Missing or invalid settings: ${describe(parsed.error)}`);
  return {
    backend: /** @type {const} */ ('supabase'),
    port,
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
  };
}

/** Name the bad settings without echoing their values. @param {z.ZodError} error */
function describe(error) {
  return [...new Set(error.issues.map((issue) => issue.path.join('.')))].join(', ');
}
