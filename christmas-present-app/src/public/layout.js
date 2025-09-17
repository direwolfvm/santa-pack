(function injectUswdsAssets() {
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;

  if (!head.querySelector('link[data-uswds]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/uswds@3.7.1/dist/css/uswds.min.css';
    link.setAttribute('data-uswds', 'true');
    head.appendChild(link);
  }

  if (!head.querySelector('script[data-uswds]')) {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/uswds@3.7.1/dist/js/uswds.min.js';
    script.defer = true;
    script.setAttribute('data-uswds', 'true');
    head.appendChild(script);
  }
})();

function ensureHeaderShell() {
  const body = document.body;
  if (!body) return;

  let nav = document.getElementById('nav');
  if (!nav) {
    nav = document.createElement('header');
    nav.id = 'nav';
    body.insertBefore(nav, body.firstChild);
  }

  const needsDefaultContent = !nav.innerHTML.trim();
  nav.classList.add('usa-header', 'usa-header--basic', 'site-header');

  if (needsDefaultContent) {
    nav.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'usa-nav-container site-nav-container';
    const navbar = document.createElement('div');
    navbar.className = 'usa-navbar';
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
    container.appendChild(navbar);
    nav.appendChild(container);
  }
}

function ensureFooterShell() {
  const body = document.body;
  if (!body) return;

  let footer = document.querySelector('footer.site-footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.className = 'usa-footer usa-footer--slim site-footer';
    body.appendChild(footer);
  }

  if (!footer.querySelector('.site-footer__inner')) {
    const container = document.createElement('div');
    container.className = 'grid-container site-footer__inner';

    const content = document.createElement('div');
    content.className = 'usa-footer__primary-content';

    const small = document.createElement('small');
    small.textContent = `© ${new Date().getFullYear()} Santa Pack. Happy holidays!`;

    content.appendChild(small);
    container.appendChild(content);

    footer.appendChild(container);
  }
}

function wrapContentInCard() {
  if (document.querySelector('.page-card')) {
    return;
  }

  const body = document.body;
  const nav = document.getElementById('nav');
  const footer = document.querySelector('footer.site-footer');
  const snow = document.getElementById('snow-container');

  if (!body) return;

  const staticElements = new Set();
  if (nav) staticElements.add(nav);
  if (footer) staticElements.add(footer);
  if (snow) staticElements.add(snow);

  const contentElements = [];
  body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (staticElements.has(node)) return;
    if (node.tagName === 'SCRIPT') return;
    contentElements.push(node);
  });

  if (!contentElements.length) return;

  const main = document.createElement('main');
  main.className = 'usa-section page-main';

  const grid = document.createElement('div');
  grid.className = 'grid-container';
  main.appendChild(grid);

  const card = document.createElement('div');
  card.className = 'usa-card page-card';
  grid.appendChild(card);

  const container = document.createElement('div');
  container.className = 'usa-card__container';
  card.appendChild(container);

  const cardHeader = document.createElement('header');
  cardHeader.className = 'usa-card__header page-card__header';
  container.appendChild(cardHeader);

  const elements = contentElements.slice();
  let headingIndex = elements.findIndex((el) => /^H[1-6]$/.test(el.tagName));
  let heading;
  if (headingIndex !== -1) {
    heading = elements.splice(headingIndex, 1)[0];
  }
  if (!heading) {
    heading = document.createElement('h1');
    heading.textContent = document.title || 'Santa Pack';
  }
  heading.classList.add('page-title');
  cardHeader.appendChild(heading);

  const cardBody = document.createElement('div');
  cardBody.className = 'usa-card__body page-card__body';
  container.appendChild(cardBody);

  const cardFooter = document.createElement('div');
  cardFooter.className = 'usa-card__footer page-card__footer';
  container.appendChild(cardFooter);

  const footerElements = [];
  elements.forEach((el) => {
    if (el.hasAttribute('data-card-footer') || el.classList.contains('card-footer')) {
      footerElements.push(el);
    }
  });

  footerElements.forEach((el) => {
    const index = elements.indexOf(el);
    if (index > -1) {
      elements.splice(index, 1);
    }
  });

  elements.forEach((el) => {
    cardBody.appendChild(el);
  });

  if (footerElements.length) {
    footerElements.forEach((el) => {
      cardFooter.appendChild(el);
    });
  } else {
    const footerNote = document.createElement('p');
    footerNote.className = 'page-card__footer-note';
    footerNote.textContent = 'Need something else? Use the navigation above or contact your family organizer.';
    cardFooter.appendChild(footerNote);
  }

  if (footer && footer.parentNode) {
    body.insertBefore(main, footer);
  } else if (snow && snow.parentNode) {
    body.insertBefore(main, snow);
  } else {
    body.appendChild(main);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ensureHeaderShell();
  ensureFooterShell();
  wrapContentInCard();
});
