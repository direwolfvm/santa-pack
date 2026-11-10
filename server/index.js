import { loadConfig } from './config.js';

let config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(/** @type {Error} */ (error).message, '(see .env.example)');
  process.exit(1);
}

/** @type {import('express').Express} */
let app;
if (config.backend === 'firebase') {
  const { connectFirebase } = await import('./firebase/admin.js');
  const { createStore } = await import('./firebase/store.js');
  const { default: createFirebaseApp } = await import('./firebase/app.js');
  const { db, auth } = connectFirebase(config);
  app = createFirebaseApp({
    store: createStore(db),
    auth,
    webConfig: config.webConfig,
    allowedOrigins: config.allowedOrigins,
  });
} else {
  const { default: createApp } = await import('./app.js');
  const { createSupabase } = await import('./db/supabaseClient.js');
  const { default: createFamiliesRouter } = await import('./routes/families.js');
  const { default: createPresentsRouter } = await import('./routes/presents.js');
  const supabase = createSupabase(config.supabaseUrl, config.supabaseAnonKey);
  app = createApp({
    presentsRoutes: createPresentsRouter(supabase),
    familiesRoutes: createFamiliesRouter(supabase),
    publicConfig: { supabaseUrl: config.supabaseUrl, supabaseAnonKey: config.supabaseAnonKey },
  });
}

const server = app.listen(config.port, () => {
  console.log(`Santa Pack (${config.backend}) is ready at http://localhost:${config.port}`);
});

// Cloud Run sends SIGTERM before stopping an instance.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
