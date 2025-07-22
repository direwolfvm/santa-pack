function initNav() {
  const navContainer = document.getElementById('nav');
  if (!navContainer) return;
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
  navContainer.appendChild(homeBtn);

  if (familyId) {
    const giftBtn = document.createElement('button');
    giftBtn.textContent = 'Gift Rounds';
    giftBtn.addEventListener('click', () => {
      window.location.href = `giftRounds.html?familyId=${familyId}&familyName=${encodeURIComponent(familyName || '')}`;
    });
    navContainer.appendChild(giftBtn);
  }

  if (familyId && personId) {
    const personBtn = document.createElement('button');
    personBtn.textContent = 'Person';
    personBtn.addEventListener('click', () => {
      window.location.href = `person.html?familyId=${familyId}&familyName=${encodeURIComponent(familyName || '')}&personId=${personId}&personName=${encodeURIComponent(personName || '')}&stage=${encodeURIComponent(stage || '')}&giftRoundId=${giftRoundId || ''}`;
    });
    navContainer.appendChild(personBtn);
  }
}

document.addEventListener('DOMContentLoaded', initNav);
