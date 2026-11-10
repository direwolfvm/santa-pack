/**
 * Small DOM builder. Text is always set with textContent, so data from the API
 * can never become markup. (innerHTML is banned by lint in app/.)
 *
 * @typedef {string | number | Node | null | undefined | false} Child
 * @typedef {Record<string, string | number | boolean | null | undefined | EventListener>} Attrs
 */

/**
 * h('button', { class: 'secondary', onclick: fn }, 'Save')
 *
 * Attributes starting with "on" become event listeners; `true` sets a boolean
 * attribute; null/undefined/false are skipped.
 *
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Attrs | null} [attrs]
 * @param {...(Child | Child[])} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'value' && 'value' in el) {
      /** @type {HTMLInputElement} */ (/** @type {unknown} */ (el)).value = String(value);
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

/** @param {Element} parent @param {(Child | Child[])[]} children */
export function append(parent, children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replace an element's contents. @param {Element} el @param {...(Child | Child[])} children */
export function replace(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

/** @param {string} name */
export function param(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * A same-site path to return to after signing in, or '/'. Rejects anything
 * that could send the user to another site (`//evil`, `https:`, `\\`).
 *
 * @param {string | null} next
 */
export function safeNextPath(next) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}
