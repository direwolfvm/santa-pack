const SUPABASE_URL = 'https://nlcisvrrkypadyjzsfnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY2lzdnJya3lwYWR5anpzZm5qIiwi
cm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNDUzMTAsImV4cCI6MjA2NzgyMTMxMH0.QURkxMU1XcS7TfO1MFcs5wC3-A4Beon1Fc8A97QgJU4';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function authFetch(url, options = {}) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    throw new Error('No active session');
  }
  const headers = options.headers ? { ...options.headers } : {};
  headers['Authorization'] = `Bearer ${session.access_token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    window.location.href = 'login.html';
    throw new Error('Unauthorized');
  }
  return res;
}

window.authFetch = authFetch;
window.supabaseClient = supabaseClient;
