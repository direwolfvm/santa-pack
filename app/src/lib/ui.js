import { h } from './dom.js';

/**
 * Announce a message in the page's live region (screen readers hear it) and
 * show it on screen.
 *
 * @param {string} message
 * @param {'info' | 'error'} [kind]
 */
export function announce(message, kind = 'info') {
  let region = document.getElementById('announcer');
  if (!region) {
    region = h('div', { id: 'announcer', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  region.dataset.kind = kind;
  region.textContent = message;
  region.hidden = false;
  window.clearTimeout(Number(region.dataset.timer));
  region.dataset.timer = String(window.setTimeout(() => region && (region.hidden = true), 6000));
}

/** @param {unknown} error */
export function announceError(error) {
  announce(error instanceof Error ? error.message : 'Something went wrong. Please try again.', 'error');
}

/**
 * Run an async action while a button shows it's busy, reporting failures.
 *
 * @param {HTMLButtonElement} button
 * @param {() => Promise<void>} action
 */
export async function withBusy(button, action) {
  const label = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    await action();
  } catch (error) {
    announceError(error);
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = label;
  }
}

/**
 * Wire a form: read its fields, run `action`, and report errors. The submit
 * button is disabled while it runs.
 *
 * @param {HTMLFormElement} form
 * @param {(data: Record<string, string>) => Promise<void>} action
 */
export function onSubmit(form, action) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const button = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));
    const data = /** @type {Record<string, string>} */ (Object.fromEntries(new FormData(form)));
    void withBusy(button, () => action(data));
  });
}

/**
 * An accessible confirmation dialog (replaces window.confirm).
 *
 * @param {string} message
 * @param {{ confirmLabel?: string, danger?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, { confirmLabel = 'Yes, do it', danger = false } = {}) {
  return new Promise((resolve) => {
    const confirm = h('button', { type: 'submit', value: 'yes', class: danger ? 'danger' : null }, confirmLabel);
    const dialog = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': 'dialog-message' },
      h(
        'form',
        { method: 'dialog' },
        h('p', { id: 'dialog-message' }, message),
        h(
          'div',
          { class: 'dialog__actions' },
          h('button', { type: 'submit', value: 'no', class: 'secondary' }, 'Cancel'),
          confirm,
        ),
      ),
    );
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'yes');
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
    confirm.focus();
  });
}

/** @param {'giving' | 'guessing' | 'complete'} stage */
export function stageBadge(stage) {
  return h('span', { class: `stage-badge stage-badge--${stage}` }, stage);
}

/** @param {string} message */
export function emptyState(message) {
  return h('p', { class: 'empty-state' }, message);
}

/**
 * A table with a scroll wrapper.
 * @param {string[]} headings
 * @param {Node[]} rows
 * @param {string} [caption]
 */
export function table(headings, rows, caption) {
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      null,
      caption ? h('caption', { class: 'visually-hidden' }, caption) : null,
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          headings.map((text) => h('th', { scope: 'col' }, text)),
        ),
      ),
      h('tbody', null, rows),
    ),
  );
}
