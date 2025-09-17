async function initNav() {
  const navContainer = document.getElementById('nav');
  if (!navContainer) return;

  navContainer.classList.add('usa-header', 'usa-header--basic', 'site-header');

  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return;
  }

  let isAdmin = false;
  let isManager = false;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', data.session.user.id)
    .maybeSingle();

  if (profile) {
    if (profile.role === 'admin') {
      isAdmin = true;
    } else if (profile.role === 'manager') {
      isManager = true;
    }
  }

  const { data: persons } = await supabaseClient
    .from('person')
    .select('id, family, family_pending')
    .eq('user_profile', data.session.user.id);

  if (!persons || persons.length === 0 || !persons.some((p) => p.family || p.family_pending)) {
    window.location.href = 'createPerson.html';
    return;
  }

  navContainer.innerHTML = '';

  const navWrapper = document.createElement('div');
  navWrapper.className = 'usa-nav-container site-nav-container';
  navContainer.appendChild(navWrapper);

  const navbar = document.createElement('div');
  navbar.className = 'usa-navbar';
  navWrapper.appendChild(navbar);

  const logo = document.createElement('div');
  logo.className = 'usa-logo';
  const logoEm = document.createElement('em');
  logoEm.className = 'usa-logo__text';
  const logoLink = document.createElement('a');
  logoLink.href = 'index.html';
  logoLink.title = 'Santa Pack home';
  logoLink.textContent = 'Santa Pack';
  logoEm.appendChild(logoLink);
  logo.appendChild(logoEm);
  navbar.appendChild(logo);

  const navElement = document.createElement('nav');
  navElement.className = 'usa-nav';
  navElement.setAttribute('aria-label', 'Primary navigation');
  navWrapper.appendChild(navElement);

  const primaryList = document.createElement('ul');
  primaryList.className = 'usa-nav__primary usa-accordion site-nav__primary';
  navElement.appendChild(primaryList);

  const secondary = document.createElement('div');
  secondary.className = 'usa-nav__secondary site-nav__secondary';
  navElement.appendChild(secondary);

  const secondaryList = document.createElement('ul');
  secondaryList.className = 'usa-nav__secondary-links site-nav__secondary-links';
  secondary.appendChild(secondaryList);

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  function addPrimaryLink(label, url) {
    const li = document.createElement('li');
    li.className = 'usa-nav__primary-item';

    const link = document.createElement('a');
    link.className = 'usa-nav__link';
    link.href = url;
    const span = document.createElement('span');
    span.textContent = label;
    link.appendChild(span);

    const pageName = (url || '').split('?')[0];
    if (currentPage === pageName) {
      link.setAttribute('aria-current', 'page');
    }

    li.appendChild(link);
    primaryList.appendChild(li);
  }

  function addSecondaryLink(label, url) {
    const li = document.createElement('li');
    li.className = 'usa-nav__secondary-item site-nav__secondary-item';
    const link = document.createElement('a');
    link.href = url;
    link.textContent = label;
    if (currentPage === (url || '').split('?')[0]) {
      link.setAttribute('aria-current', 'page');
    }
    li.appendChild(link);
    secondaryList.appendChild(li);
  }

  const params = new URLSearchParams(window.location.search);
  const familyId = params.get('familyId');
  const familyName = params.get('familyName');
  const giftRoundId = params.get('giftRoundId');
  const personId = params.get('personId');
  const personName = params.get('personName');
  const stage = params.get('stage');

  addPrimaryLink('Families', 'index.html');

  if (familyId) {
    const giftRoundsUrl = `giftRounds.html?familyId=${familyId}&familyName=${encodeURIComponent(familyName || '')}`;
    addPrimaryLink('Gift Rounds', giftRoundsUrl);
  }

  if (familyId && personId) {
    const personUrl = `person.html?familyId=${familyId}&familyName=${encodeURIComponent(familyName || '')}&personId=${personId}&personName=${encodeURIComponent(personName || '')}&stage=${encodeURIComponent(stage || '')}&giftRoundId=${giftRoundId || ''}`;
    addPrimaryLink('Person', personUrl);
  }

  addSecondaryLink('Profile', 'profile.html');

  if (isAdmin) {
    addSecondaryLink('Management Console', 'admin.html');
  }

  let canManageFamily = false;
  if (familyId) {
    if (isAdmin) {
      canManageFamily = true;
    } else if (isManager) {
      const { data: mgrPerson } = await supabaseClient
        .from('person')
        .select('id')
        .eq('user_profile', data.session.user.id)
        .eq('family', familyId)
        .maybeSingle();
      if (mgrPerson) {
        canManageFamily = true;
      }
    }
  }

  if (canManageFamily) {
    const manageUrl = `manageFamily.html?familyId=${familyId}&familyName=${encodeURIComponent(familyName || '')}`;
    addSecondaryLink('Manage Family', manageUrl);
  }

  const signOutContainer = document.createElement('div');
  signOutContainer.className = 'site-nav__signout';
  const signOutBtn = document.createElement('button');
  signOutBtn.type = 'button';
  signOutBtn.className = 'usa-button usa-button--secondary';
  signOutBtn.textContent = 'Sign Out';
  signOutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
  signOutContainer.appendChild(signOutBtn);
  secondary.appendChild(signOutContainer);
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
});
