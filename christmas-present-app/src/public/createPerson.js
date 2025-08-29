document.addEventListener('DOMContentLoaded', async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return;
  }
  const user = data.session.user;

  const { data: personData } = await supabaseClient
    .from('person')
    .select('id, name, family, family_pending')
    .eq('user_profile', user.id);

  let existingPerson = personData && personData.length > 0 ? personData[0] : null;

  if (existingPerson && (existingPerson.family || existingPerson.family_pending)) {
    window.location.href = 'index.html';
    return;
  }

  if (existingPerson && existingPerson.name) {
    document.getElementById('personName').value = existingPerson.name;
  }

  const families = await fetch('/api/families').then(r => r.json());
  const container = document.getElementById('familiesTable');
  container.innerHTML = '';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Family', 'Status/Action'].forEach(t => {
    const th = document.createElement('th');
    th.textContent = t;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  families.forEach(f => {
    const row = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.textContent = f.name;
    row.appendChild(nameTd);

    const actionTd = document.createElement('td');
    if (existingPerson && existingPerson.family === f.id) {
      actionTd.textContent = 'Member';
    } else if (existingPerson && existingPerson.family_pending === f.id) {
      actionTd.textContent = 'Pending Approval';
    } else {
      const btn = document.createElement('button');
      btn.textContent = 'Request to Join';
      btn.addEventListener('click', async () => {
        const name = document.getElementById('personName').value.trim();
        if (!name) {
          alert('Please enter your name.');
          return;
        }
        if (existingPerson) {
          await supabaseClient
            .from('person')
            .update({ name, family_pending: f.id })
            .eq('id', existingPerson.id);
        } else {
          const { data: inserted } = await supabaseClient
            .from('person')
            .insert({ name, user_profile: user.id, family_pending: f.id })
            .select()
            .single();
          existingPerson = inserted;
        }
        alert('Request to join family submitted.');
        window.location.href = 'index.html';
      });
      actionTd.appendChild(btn);
    }
    row.appendChild(actionTd);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
});

