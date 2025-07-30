document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  async function ensureProfile(user) {
    if (!user) return;
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile) {
      await supabaseClient.from('profiles').insert({ id: user.id, role: 'user' });
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    } else {
      await ensureProfile(data.user);
      window.location.href = 'index.html';
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    if (data.session) {
      await ensureProfile(data.user);
      window.location.href = 'index.html';
    } else {
      alert('Check your email for a confirmation link to log in.');
    }
  });
});
