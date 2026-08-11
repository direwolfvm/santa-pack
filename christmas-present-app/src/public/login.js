document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const resetStatus = document.getElementById('resetStatus');

  if (new URLSearchParams(window.location.search).get('reset') === 'success') {
    resetStatus.textContent = 'Your password has been updated. Sign in with the new one.';
    document.querySelector('.auth-recovery').open = true;
  }

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

  async function finishLogin(user) {
    await ensureProfile(user);
    const { data: person } = await supabaseClient
      .from('person')
      .select('id')
      .eq('user_profile', user.id)
      .maybeSingle();

    if (person) {
      window.location.href = 'index.html';
    } else {
      window.location.href = 'createPerson.html';
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
      await finishLogin(data.user);
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
      await finishLogin(data.user);
    } else {
      alert('Check your email for a confirmation link to log in.');
    }
  });

  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value.trim();
    const button = forgotPasswordForm.querySelector('button');
    button.disabled = true;
    resetStatus.textContent = 'Sending your reset link…';
    const redirectTo = `${window.location.origin}/reset-password.html`;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    button.disabled = false;
    if (error) {
      resetStatus.textContent = error.message;
      return;
    }
    resetStatus.textContent = 'If that address belongs to an account, a reset link is on its way.';
  });
});
