async function initNav() {
  const navContainer = document.getElementById('nav');
  if (!navContainer) return;
  navContainer.innerHTML = '';

  const navLeft = document.createElement('div');
  navLeft.className = 'nav-left';
  const navRight = document.createElement('div');
  navRight.className = 'nav-right';
  navContainer.appendChild(navLeft);
  navContainer.appendChild(navRight);

  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return;
  }

  let isAdmin = false;
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', data.session.user.id)
    .maybeSingle();
  if (profile && profile.role === 'admin') {
    isAdmin = true;
  }

  const { data: person } = await supabaseClient
    .from('person')
    .select('id')
    .eq('user_profile', data.session.user.id)
    .maybeSingle();
  if (!person) {
    window.location.href = 'createPerson.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const familyId = params.get('familyId');
  const familyName = params.get('familyName');
  const giftRoundId = params.get('giftRoundId');
  const personId = params.get('personId');
  const personName = params.get('personName');
  const stage = params.get('stage');

  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'Families';
  homeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  navLeft.appendChild(homeBtn);

  if (familyId) {
    const giftBtn = document.createElement('button');
    giftBtn.textContent = 'Gift Rounds';
    giftBtn.addEventListener('click', () => {
      window.location.href = `giftRounds.html?familyId=${familyId}&familyName=${encodeURIComponent(familyName || '')}`;
    });
    navLeft.appendChild(giftBtn);
  }

  if (familyId && personId) {
    const personBtn = document.createElement('button');
    personBtn.textContent = 'Person';
    personBtn.addEventListener('click', () => {
      window.location.href = `person.html?familyId=${familyId}&familyName=${encodeURIComponent(familyName || '')}&personId=${personId}&personName=${encodeURIComponent(personName || '')}&stage=${encodeURIComponent(stage || '')}&giftRoundId=${giftRoundId || ''}`;
    });
    navLeft.appendChild(personBtn);
  }

  const profileBtn = document.createElement('button');
  profileBtn.textContent = 'Profile';
  profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
  navRight.appendChild(profileBtn);

  if (isAdmin) {
    const adminBtn = document.createElement('button');
    adminBtn.textContent = 'Management Console';
    adminBtn.addEventListener('click', () => {
      window.location.href = 'admin.html';
    });
    navRight.appendChild(adminBtn);
  }

  const signOutBtn = document.createElement('button');
  signOutBtn.textContent = 'Sign Out';
  signOutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
  navRight.appendChild(signOutBtn);

  const footer = document.createElement('footer');
  document.body.appendChild(footer);
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
});
