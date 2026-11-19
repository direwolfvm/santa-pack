import '../styles.css';
import guide from '../../../docs/guide.md?raw';
import { h, replace } from '../lib/dom.js';
import { renderMarkdown } from '../lib/markdown.js';
import { renderShell, showNavIfSignedIn } from '../lib/shell.js';

// The Help page is docs/guide.md, so the guide in the repo and in the app are
// one and the same. It's public: people can read it before signing up.

const { title, nodes, sections } = renderMarkdown(guide);
const [intro, ...rest] = nodes;
const shell = renderShell({ eyebrow: 'Help', title, subtitle: intro?.textContent ?? '' });
document.title = `${title} · Santa Pack`;

replace(
  shell.body,
  h(
    'nav',
    { class: 'panel help-contents', 'aria-labelledby': 'contents-heading' },
    h('h2', { id: 'contents-heading' }, 'On this page'),
    h(
      'ol',
      null,
      sections.map(({ id, text }) => h('li', null, h('a', { href: `#${id}` }, text))),
    ),
  ),
  h('article', { class: 'help-guide' }, rest),
);
// If the page was opened at #a-section, go there now that it exists.
if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
await showNavIfSignedIn(shell);
