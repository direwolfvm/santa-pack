import createApp from './app.js';
import { createSupabase } from './db/supabaseClient.js';
import createFamiliesRouter from './routes/families.js';
import createPresentsRouter from './routes/presents.js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY must be set (see .env.example).');
  process.exit(1);
}

const port = Number.parseInt(process.env.PORT ?? '', 10) || 8080;
const supabase = createSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = createApp({
  presentsRoutes: createPresentsRouter(supabase),
  familiesRoutes: createFamiliesRouter(supabase),
  publicConfig: { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY },
});

const server = app.listen(port, () => {
  console.log(`Santa Pack is ready at http://localhost:${port}`);
});

// Cloud Run sends SIGTERM before stopping an instance.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
