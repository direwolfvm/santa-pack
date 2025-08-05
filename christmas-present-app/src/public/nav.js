async function initNav() {
  const navContainer = document.getElementById('nav');
  if (!navContainer) return;

  // Ensure footer exists for all pages using the nav
  if (!document.getElementById('footer')) {
    const footer = document.createElement('footer');
    footer.id = 'footer';
    document.body.appendChild(footer);
  }

  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return;
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

  const left = document.createElement('div');
  left.classList.add('nav-left');
  const right = document.createElement('div');
  right.classList.add('nav-right');
  navContainer.appendChild(left);
  navContainer.appendChild(right);

  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'Families';
  homeBtn.classList.add('nav-btn');
  homeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  left.appendChild(homeBtn);

  if (familyId) {
    const giftBtn = document.createElement('button');
    giftBtn.textContent = 'Gift Rounds';
    giftBtn.classList.add('nav-btn');
    giftBtn.addEventListener('click', () => {
      window.location.href = `giftRounds.html?familyId=${familyId}&familyName=${encodeURIComponent(familyName || '')}`;
    });
    left.appendChild(giftBtn);
  }

  if (familyId && personId) {
    const personBtn = document.createElement('button');
    personBtn.textContent = 'Person';
    personBtn.classList.add('nav-btn');
    personBtn.addEventListener('click', () => {
      window.location.href = `person.html?familyId=${familyId}&familyName=${encodeURIComponent(familyName || '')}&personId=${personId}&personName=${encodeURIComponent(personName || '')}&stage=${encodeURIComponent(stage || '')}&giftRoundId=${giftRoundId || ''}`;
    });
    left.appendChild(personBtn);
  }

  const profileBtn = document.createElement('button');
  profileBtn.textContent = 'Profile';
  profileBtn.classList.add('nav-btn');
  profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
  right.appendChild(profileBtn);

  const adminBtn = document.createElement('button');
  adminBtn.textContent = 'Management';
  adminBtn.classList.add('nav-btn');
  adminBtn.style.display = 'none';
  adminBtn.addEventListener('click', () => {
    window.location.href = 'admin.html';
  });
  right.appendChild(adminBtn);

  const signOutBtn = document.createElement('button');
  signOutBtn.textContent = 'Sign Out';
  signOutBtn.classList.add('nav-btn');
  signOutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
  right.appendChild(signOutBtn);

  // Show management console for admins
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', data.session.user.id)
    .maybeSingle();
  if (profile && profile.role === 'admin') {
    adminBtn.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
});
