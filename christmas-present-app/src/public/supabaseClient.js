const SUPABASE_URL = 'https://nlcisvrrkypadyjzsfnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY2lzdnJya3lwYWR5anpzZm5qIiwiY3RhdGUiOnRydWUsImF1ZCI6ImFub24iLCJpYXQiOjE3NTIyNDUzMTAsImV4cCI6MjA2NzgyMTMxMH0.QURkxMU1XcS7TfO1MFcs5wC3-A4Beon1Fc8A97QgJU4';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return originalFetch(input, { ...init, headers });
};
