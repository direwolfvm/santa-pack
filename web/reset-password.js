document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('resetPasswordForm');
  const instructions = document.getElementById('recoveryInstructions');
  const status = document.getElementById('passwordStatus');
  const hashParams = new URLSearchParams(window.location.hash.slice(1));

  if (hashParams.get('error_description')) {
    instructions.textContent = 'This recovery link is invalid or has expired.';
    status.textContent = hashParams.get('error_description');
    return;
  }

  const showFormForSession = (session) => {
    if (!session) return false;
    instructions.textContent = 'Use at least eight characters for your new password.';
    form.hidden = false;
    return true;
  };

  const { data } = await supabaseClient.auth.getSession();
  if (!showFormForSession(data.session)) {
    instructions.textContent = 'Open the password-reset link from your email to continue.';
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') showFormForSession(session);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('newPassword').value;
    const confirmation = document.getElementById('confirmPassword').value;
    if (password !== confirmation) {
      status.textContent = 'Those passwords do not match.';
      return;
    }
    const button = form.querySelector('button');
    button.disabled = true;
    status.textContent = 'Saving your new password…';
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      button.disabled = false;
      status.textContent = error.message;
      return;
    }
    await supabaseClient.auth.signOut();
    window.location.replace('login.html?reset=success');
  });
});
