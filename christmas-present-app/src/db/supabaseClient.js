require('dotenv').config();

// Configure proxy support for environments that require it
if (!process.env.GLOBAL_AGENT_HTTP_PROXY && (process.env.HTTPS_PROXY || process.env.HTTP_PROXY)) {
  process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
}
require('global-agent/bootstrap');

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
