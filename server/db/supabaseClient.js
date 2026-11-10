import { createClient } from '@supabase/supabase-js';

/**
 * Create the shared Supabase client. `forRequest(token)` returns a client that
 * acts as the signed-in user, so row-level security applies to their queries.
 *
 * @param {string} url
 * @param {string} anonKey
 */
export function createSupabase(url, anonKey) {
  const supabase = createClient(url, anonKey);

  /** @param {string | null} token */
  const forRequest = (token) => {
    if (!token) return supabase;
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  };

  return Object.assign(supabase, { forRequest });
}
