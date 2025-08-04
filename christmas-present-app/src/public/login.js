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

  async function finishLogin(user) {
    await ensureProfile(user);
    let { data: profile } = await supabaseClient
      .from('profiles')
      .select('person_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.person_id) {
      const { data: person } = await supabaseClient
        .from('person')
        .select('id')
        .eq('user_profile', user.id)
        .maybeSingle();

      if (person) {
        await supabaseClient
          .from('profiles')
          .update({ person_id: person.id })
          .eq('id', user.id);
        window.location.href = 'index.html';
      } else {
        window.location.href = 'createPerson.html';
      }
    } else {
      window.location.href = 'index.html';
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
});
