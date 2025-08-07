document.addEventListener('DOMContentLoaded', async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return;
  }
  const user = data.session.user;
  const { data: existingPersons } = await supabaseClient
    .from('person')
    .select('id, family, family_pending')
    .eq('user_profile', user.id);
  let existingPerson = null;
  if (existingPersons && existingPersons.length > 0) {
    existingPerson = existingPersons[0];
    if (existingPersons.some(p => p.family || p.family_pending)) {
      window.location.href = 'index.html';
      return;
    }
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
    if (existingPerson) {
      await supabaseClient
        .from('person')
        .update({ name, family_pending: familyId })
        .eq('id', existingPerson.id);
      alert('Request to join family submitted.');
      window.location.href = 'index.html';
    } else {
      const res = await fetch(`/api/families/${familyId}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, user_profile: user.id })
      });
      const created = (await res.json())[0];
      if (created) {
        alert('Request to join family submitted.');
        window.location.href = 'index.html';
      }
    }
  });
});
