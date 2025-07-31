document.addEventListener('DOMContentLoaded', async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return;
  }
  const user = data.session.user;
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('person_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile && profile.person_id) {
    window.location.href = 'index.html';
    return;
  }

  const families = await fetch('/api/families').then(r => r.json());
  const select = document.getElementById('familySelect');
  families.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    select.appendChild(opt);
  });

  document.getElementById('personForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('personName').value;
    const familyId = select.value;
    const res = await fetch(`/api/families/${familyId}/people`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const created = (await res.json())[0];
    if (created) {
      await supabaseClient
        .from('profiles')
        .update({ person_id: created.id })
        .eq('id', user.id);
      window.location.href = 'index.html';
    }
  });
});
