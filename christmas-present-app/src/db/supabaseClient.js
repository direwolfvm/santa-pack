const { createClient } = require('@supabase/supabase-js');

// The application expects the Supabase credentials to be provided via
// environment variables. They are prefixed with `NEXT_PUBLIC_` so the same
// variables can be shared with a future front-end implementation.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;