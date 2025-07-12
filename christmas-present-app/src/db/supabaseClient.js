require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in .env');
}

// console.log('SUPABASE_URL:', supabaseUrl);
// console.log('SUPABASE_KEY:', supabaseKey);

const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;
let options = {};
if (proxy) {
  const agent = new HttpsProxyAgent(proxy);
  const customFetch = (url, opts = {}) => fetch(url, { ...opts, agent });
  options.fetch = customFetch;
}

const supabase = createClient(supabaseUrl, supabaseKey, options);

module.exports = supabase;
