import express from 'express';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('../web', import.meta.url));

/**
 * Build the Express app. Routers are passed in so tests can run the app
 * without a database connection.
 *
 * @param {object} options
 * @param {import('express').Router} options.presentsRoutes
 * @param {import('express').Router} options.familiesRoutes
 * @param {{ supabaseUrl?: string, supabaseAnonKey?: string }} [options.publicConfig]
 *   Browser-safe settings served to the frontend.
 */
export default function createApp({ presentsRoutes, familiesRoutes, publicConfig = {} }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use('/api/presents', presentsRoutes);
  app.use('/api/families', familiesRoutes);
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/supabaseClient.js', (_req, res) => {
    const url = JSON.stringify(publicConfig.supabaseUrl ?? '');
    const key = JSON.stringify(publicConfig.supabaseAnonKey ?? '');
    res.type('application/javascript').send(`const supabaseClient = supabase.createClient(${url}, ${key});`);
  });
  app.use(express.static(webRoot));

  /** @type {import('express').ErrorRequestHandler} */
  const errorHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong at the North Pole.' });
  };
  app.use(errorHandler);

  return app;
}
