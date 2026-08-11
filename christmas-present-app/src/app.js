const express = require('express');
const path = require('path');

function createApp({ presentsRoutes, familiesRoutes } = {}) {
  const app = express();
  const resolvedPresentsRoutes = presentsRoutes || require('./routes/presents');
  const resolvedFamiliesRoutes = familiesRoutes || require('./routes/families');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use('/api/presents', resolvedPresentsRoutes);
  app.use('/api/families', resolvedFamiliesRoutes);
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/supabaseClient.js', (_req, res) => {
    const url = JSON.stringify(process.env.SUPABASE_URL || '');
    const key = JSON.stringify(process.env.SUPABASE_ANON_KEY || '');
    res.type('application/javascript').send(
      `const supabaseClient = supabase.createClient(${url}, ${key});`
    );
  });
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong at the North Pole.' });
  });

  return app;
}

module.exports = createApp;
