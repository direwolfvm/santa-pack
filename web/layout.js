const PAGE_COPY = {
  'index.html': ['The nice list starts here', 'Keep every family exchange, mystery gift, and merry milestone in one place.'],
  'giftRounds.html': ['Exchange headquarters', 'Plan the giving, guessing, and grand reveal without spoiling the surprise.'],
  'people.html': ['Choose a merry maker', 'Pick who you are playing as for this round. Organizers can help on someone’s behalf.'],
  'presents.html': ['Santa’s secret ledger', 'Add one thoughtful gift for each person, then cloak it with a mysterious name.'],
  'guesses.html': ['The great gift guess-off', 'Lock in each guess before the wrapping paper comes off.'],
  'profile.html': ['Your North Pole file', 'Keep your account details and organizer access up to date.'],
  'manageFamily.html': ['Elf desk', 'Welcome new members and keep this family’s guest list tidy.'],
  'admin.html': ['North Pole control room', 'A bird’s-eye view of families, rounds, members, and presents.'],
  'createPerson.html': ['Find your people', 'Tell us your name and request a spot in an existing family.'],
  'summary-giving.html': ['Round progress', 'See who has finished their list without revealing what is under the tree.'],
  'summary-guessing.html': ['Guessing progress', 'Track the guesses and celebrate when everyone is ready for the reveal.'],
  'summary-complete.html': ['The grand reveal', 'See who knew their Santas best—and who fooled the whole room.'],
  'person.html': ['Personal workshop', 'Jump into a round or check its progress.'],
  'login.html': ['Welcome to Santa Pack', 'A cozy little home for family gift exchanges, suspicious packages, and very serious guessing.'],
  'reset-password.html': ['A fresh secret', 'Choose a new password, then get back to the merry mischief.']
};

function currentPage() {
  return window.location.pathname.split('/').pop() || 'index.html';
}

function createBrand() {
  const brand = document.createElement('a');
  brand.className = 'site-brand';
  brand.href = 'index.html';
  brand.setAttribute('aria-label', 'Santa Pack home');
  brand.innerHTML = '<span class="site-brand__mark" aria-hidden="true">★</span><span><span class="site-brand__name">Santa Pack</span><span class="site-brand__tagline">Merry mischief managed</span></span>';
  return brand;
}

function ensureHeaderShell() {
  const body = document.body;
  if (!body || body.classList.contains('login-page')) return;
  let nav = document.getElementById('nav');
  if (!nav) {
    nav = document.createElement('header');
    nav.id = 'nav';
    body.insertBefore(nav, body.firstChild);
  }
  nav.classList.add('site-header');
  if (!nav.innerHTML.trim()) {
    const container = document.createElement('div');
    container.className = 'site-nav-container';
    container.appendChild(createBrand());
    nav.appendChild(container);
  }
}

function ensureFooterShell() {
  const body = document.body;
  if (!body) return;
  let footer = document.querySelector('footer.site-footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.className = 'site-footer';
    body.appendChild(footer);
  }
  if (!footer.innerHTML.trim()) {
    footer.innerHTML = `<div class="site-footer__inner"><small>© ${new Date().getFullYear()} Santa Pack</small><small>Made with cocoa, cheer &amp; excellent secrets.</small></div>`;
  }
}

function enhanceTables(root) {
  root.querySelectorAll('table').forEach((table) => {
    if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrap';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

function observeDynamicContent(root) {
  const observer = new MutationObserver(() => enhanceTables(root));
  observer.observe(root, { childList: true, subtree: true });
}

function wrapContentInCard() {
  if (document.querySelector('.page-card')) return;
  const body = document.body;
  if (!body) return;
  const nav = document.getElementById('nav');
  const footer = document.querySelector('footer.site-footer');
  const snow = document.getElementById('snow-container');
  const excluded = new Set([nav, footer, snow]);
  const elements = [...body.children].filter((el) => !excluded.has(el) && el.tagName !== 'SCRIPT');
  if (!elements.length) return;

  const main = document.createElement('main');
  main.className = 'page-main';
  main.id = 'main-content';
  const grid = document.createElement('div');
  grid.className = 'grid-container';
  const card = document.createElement('article');
  card.className = 'page-card';
  const container = document.createElement('div');
  container.className = 'page-card__container';
  const cardHeader = document.createElement('header');
  cardHeader.className = 'page-card__header';
  const headingIndex = elements.findIndex((el) => /^H1$/.test(el.tagName));
  const heading = headingIndex >= 0 ? elements.splice(headingIndex, 1)[0] : document.createElement('h1');
  if (!heading.textContent) heading.textContent = document.title || 'Santa Pack';
  heading.classList.add('page-title');
  const copy = PAGE_COPY[currentPage()] || ['Christmas, organized', 'All the festive details, neatly wrapped up.'];
  const eyebrow = document.createElement('p');
  eyebrow.className = 'page-eyebrow';
  eyebrow.textContent = copy[0];
  const subtitle = document.createElement('p');
  subtitle.className = 'page-subtitle';
  subtitle.textContent = copy[1];
  cardHeader.append(eyebrow, heading, subtitle);

  const cardBody = document.createElement('div');
  cardBody.className = 'page-card__body';
  const cardFooter = document.createElement('div');
  cardFooter.className = 'page-card__footer';
  const footerElements = elements.filter((el) => el.hasAttribute('data-card-footer') || el.classList.contains('card-footer'));
  elements.filter((el) => !footerElements.includes(el)).forEach((el) => cardBody.appendChild(el));
  if (footerElements.length) footerElements.forEach((el) => cardFooter.appendChild(el));
  else cardFooter.innerHTML = '<p class="page-card__footer-note">Keep the surprise merry. Keep the clues mysterious.</p>';

  container.append(cardHeader, cardBody, cardFooter);
  card.appendChild(container);
  grid.appendChild(card);
  main.appendChild(grid);
  body.insertBefore(main, footer || snow || null);
  enhanceTables(cardBody);
  observeDynamicContent(cardBody);
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.dataset.page = currentPage().replace('.html', '');
  ensureHeaderShell();
  ensureFooterShell();
  wrapContentInCard();
});
