document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    } else {
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
    if (data.user) {
      await supabaseClient.from('profiles').insert({ id: data.user.id, role: 'user' });
      window.location.href = 'index.html';
    } else {
      alert('Check your email for a confirmation link to log in.');
    }
  });
});
