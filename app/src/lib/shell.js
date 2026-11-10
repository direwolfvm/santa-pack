import { signOut } from 'firebase/auth';
import { api } from './api.js';
import { h, replace } from './dom.js';
import { currentFirebaseUser, getFirebaseAuth } from './firebase.js';
import { announceError } from './ui.js';

/**
 * @typedef {{ uid: string, email: string, displayName: string, role: 'user' | 'admin' }} Me
 * @typedef {{ id: string, name: string, status: 'pending' | 'member', familyRole: 'member' | 'manager' }} MyFamily
 * @typedef {{ user: Me, families: MyFamily[] }} MeResponse
 */

function brand() {
  return h(
    'a',
    { class: 'site-brand', href: '/', 'aria-label': 'Santa Pack home' },
    h('span', { class: 'site-brand__mark', 'aria-hidden': 'true' }, '★'),
    h(
      'span',
      null,
      h('span', { class: 'site-brand__name' }, 'Santa Pack'),
      h('span', { class: 'site-brand__tagline' }, 'Merry mischief managed'),
    ),
  );
}

function snow() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const container = h('div', { id: 'snow-container', 'aria-hidden': 'true' });
  for (let i = 0; i < 40; i++) {
    const flake = h('div', { class: 'snowflake' }, '❄️');
    flake.style.left = `${Math.random() * 100}vw`;
    flake.style.animationDuration = `${5 + Math.random() * 5}s`;
    flake.style.fontSize = `${10 + Math.random() * 20}px`;
    flake.style.animationDelay = `${-Math.random() * 10}s`;
    container.append(flake);
  }
  return container;
}

/**
 * Build the page frame and return the regions pages fill in.
 *
 * @param {{ eyebrow: string, title: string, subtitle?: string, variant?: 'login' }} copy
 */
export function renderShell({ eyebrow, title, subtitle, variant }) {
  const nav = h('header', { class: 'site-header' }, h('div', { class: 'site-nav-container' }, brand()));
  const titleEl = h('h1', { class: 'page-title' }, title);
  const subtitleEl = h('p', { class: 'page-subtitle' }, subtitle ?? '');
  const body = h('div', { class: 'page-card__body' }, h('p', { class: 'loading' }, 'Loading…'));
  const footer = h(
    'div',
    { class: 'page-card__footer' },
    h('p', { class: 'page-card__footer-note' }, 'Keep the surprise merry. Keep the clues mysterious.'),
  );
  const main = h(
    'main',
    { class: 'page-main', id: 'main-content' },
    h(
      'div',
      { class: 'grid-container' },
      h(
        'article',
        { class: 'page-card' },
        h(
          'div',
          { class: 'page-card__container' },
          h('header', { class: 'page-card__header' }, h('p', { class: 'page-eyebrow' }, eyebrow), titleEl, subtitleEl),
          body,
          footer,
        ),
      ),
    ),
  );
  const siteFooter = h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'site-footer__inner' },
      h('small', null, `© ${new Date().getFullYear()} Santa Pack`),
      h('small', null, 'Made with cocoa, cheer & excellent secrets.'),
    ),
  );
  if (variant === 'login') document.body.classList.add('login-page');
  document.body.replaceChildren(
    h('a', { class: 'skip-link', href: '#main-content' }, 'Skip to content'),
    nav,
    main,
    siteFooter,
  );
  const flakes = snow();
  if (flakes) document.body.append(flakes);
  return { nav, title: titleEl, subtitle: subtitleEl, body, footer };
}

/**
 * Require a signed-in, verified user, then draw the navigation.
 *
 * @param {ReturnType<typeof renderShell>} shell
 * @returns {Promise<MeResponse>}
 */
export async function requireSignedIn(shell) {
  const user = await currentFirebaseUser();
  const here = encodeURIComponent(window.location.pathname + window.location.search);
  if (!user) {
    window.location.replace(`/login.html?next=${here}`);
    return new Promise(() => {});
  }
  if (!user.emailVerified) {
    window.location.replace(`/verify.html?next=${here}`);
    return new Promise(() => {});
  }
  /** @type {MeResponse} */
  const me = await api('/api/me');
  drawNav(shell.nav, me);
  return me;
}

/** @param {HTMLElement} header @param {MeResponse} me */
function drawNav(header, me) {
  const here = window.location.pathname;
  /** @param {string} label @param {string} href */
  const link = (label, href) => h('li', null, h('a', { href, 'aria-current': here === href ? 'page' : null }, label));

  const signOutButton = h('button', { type: 'button', class: 'button--small' }, 'Sign out');
  signOutButton.addEventListener('click', async () => {
    try {
      await signOut(await getFirebaseAuth());
      window.location.assign('/login.html');
    } catch (error) {
      announceError(error);
    }
  });

  replace(
    header,
    h(
      'div',
      { class: 'site-nav-container' },
      brand(),
      h(
        'nav',
        { class: 'site-nav', 'aria-label': 'Primary' },
        h('ul', { class: 'site-nav__primary' }, link('Families', '/')),
        h(
          'div',
          { class: 'site-nav__secondary' },
          h(
            'ul',
            { class: 'site-nav__secondary-links' },
            link(me.user.displayName || 'My profile', '/profile.html'),
            me.user.role === 'admin' ? link('Admin', '/admin.html') : null,
          ),
          h('div', { class: 'site-nav__signout' }, signOutButton),
        ),
      ),
    ),
  );
}

/**
 * Show a full-page error in place of the page body.
 * @param {ReturnType<typeof renderShell>} shell @param {unknown} error
 */
export function showPageError(shell, error) {
  replace(
    shell.body,
    h(
      'div',
      { class: 'status status--error', role: 'alert' },
      error instanceof Error ? error.message : 'Something went wrong.',
    ),
    h('p', null, h('a', { href: '/' }, 'Back to your families')),
  );
}
