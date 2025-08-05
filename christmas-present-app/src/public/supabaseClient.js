const SUPABASE_URL = 'https://nlcisvrrkypadyjzsfnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY2lzdnJya3lwYWR5anpzZm5qIiwi
cm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNDUzMTAsImV4cCI6MjA2NzgyMTMxMH0.QURkxMU1XcS7TfO1MFcs5wC3-A4Beon1Fc8A97QgJU4';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function authFetch(url, options = {}) {
  const { data, error } = await supabaseClient.auth.getSession();
  const session = data?.session;
  if (error || !session) {
    window.location.href = 'login.html';
    throw new Error(error?.message || 'No active session');
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

async function requireSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  const session = data?.session;
  if (error || !session) {
    window.location.href = 'login.html';
    throw new Error(error?.message || 'No active session');
  }
  return session;
}

window.authFetch = authFetch;
window.supabaseClient = supabaseClient;
window.requireSession = requireSession;

// Immediately enforce login on any page except the dedicated login screen.
// This runs as soon as the script loads so unauthenticated visitors are
// redirected before other page scripts execute and hit "Loading..." states.
const currentPage = window.location.pathname.split('/').pop()?.toLowerCase();
if (!currentPage || !currentPage.startsWith('login')) {
  // Ignore the rejection since requireSession itself performs the redirect.
  requireSession().catch(() => {});
}
