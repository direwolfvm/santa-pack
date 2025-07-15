require('dotenv').config();

// Configure proxy support for environments that require it. If `global-agent`
// is not installed (e.g. dependencies weren't reinstalled after pulling the
// latest code), skip proxy setup so the application can still start.
if (!process.env.GLOBAL_AGENT_HTTP_PROXY && (process.env.HTTPS_PROXY || process.env.HTTP_PROXY)) {
  process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
}
try {
  require('global-agent/bootstrap');
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') {
    throw err;
  }
  // eslint-disable-next-line no-console
  console.warn('global-agent not installed; skipping proxy configuration');
}

const { createClient } = require('@supabase/supabase-js');
const fetch = require('cross-fetch');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in .env');
}

// console.log('SUPABASE_URL:', supabaseUrl);
// console.log('SUPABASE_KEY:', supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey, { fetch });

module.exports = supabase;
