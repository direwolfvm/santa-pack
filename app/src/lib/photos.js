import { ApiError, goToSignIn } from './api.js';
import { h } from './dom.js';
import { currentFirebaseUser } from './firebase.js';

// Present photos. The browser never gets a public link to a photo: each one
// is fetched from the API with the sign-in token (the server decides who may
// see it) and shown from a blob: URL.

const MAX_EDGE = 1600;
const MAX_BYTES = 6 * 1024 * 1024;
const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Phones and tablets get a separate "Take photo" button that opens the camera. */
export const hasCamera = window.matchMedia('(pointer: coarse)').matches;

/** @param {string} path @param {RequestInit} [init] */
async function authorizedFetch(path, init = {}) {
  const user = await currentFirebaseUser();
  if (!user) {
    goToSignIn();
    throw new ApiError(401, 'Please sign in.');
  }
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error ?? 'Something went wrong. Please try again.');
  }
  return response;
}

/**
 * Make a photo small enough to upload quickly, as a JPEG. Drawing it onto a
 * canvas also drops its metadata, including where it was taken.
 * @param {File} file
 * @returns {Promise<Blob>}
 */
export async function shrinkPhoto(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).drawImage(
      bitmap,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    bitmap.close();
    return await new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.85),
    );
  } catch {
    // A browser that can't decode it (some HEIC files) may still upload a type the server takes.
    if (UPLOAD_TYPES.includes(file.type) && file.size <= MAX_BYTES) return file;
    throw new Error('That photo couldn’t be read. Try a JPEG or PNG.');
  }
}

/** @param {string} path @param {File} file */
export async function uploadPhoto(path, file) {
  const blob = await shrinkPhoto(file);
  await authorizedFetch(path, { method: 'PUT', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
}

/** @param {string} path */
export async function removePhoto(path) {
  await authorizedFetch(path, { method: 'DELETE' });
}

/** Loaded photos, by path and version, so a page reload doesn't fetch them again. @type {Map<string, Promise<string>>} */
const loaded = new Map();

/** A blob: URL for the photo at `path`. @param {string} path @param {string} version */
function photoUrl(path, version) {
  const key = `${path}#${version}`;
  let url = loaded.get(key);
  if (!url) {
    url = authorizedFetch(path)
      .then((response) => response.blob())
      .then((blob) => URL.createObjectURL(blob));
    url.catch(() => loaded.delete(key));
    loaded.set(key, url);
  }
  return url;
}

/**
 * Hidden file inputs behind friendly buttons. Without `capture`, phones offer
 * the camera and the photo library; with it, they go straight to the camera.
 *
 * @param {(file: File) => Promise<void>} onFile
 * @param {boolean} replacing
 */
function pickerButtons(onFile, replacing) {
  /** @param {string} label @param {boolean} camera */
  const picker = (label, camera) => {
    const input = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-hidden': 'true', tabindex: -1 });
    if (camera) input.setAttribute('capture', 'environment');
    const button = h('button', { type: 'button', class: 'secondary button--small' }, label);
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      try {
        await onFile(file);
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
    return [button, input];
  };
  return [
    hasCamera ? picker(replacing ? 'Retake' : 'Take photo', true) : null,
    picker(hasCamera ? 'Choose photo' : replacing ? 'Replace photo' : 'Add photo', false),
  ];
}

/**
 * One photo of a present: shown if it exists (and the server lets this person
 * see it), with buttons to add, replace or remove it when they're allowed to.
 *
 * @param {{
 *   path: string,
 *   version: string | undefined,
 *   label: string,
 *   hint?: string,
 *   editable?: boolean,
 *   small?: boolean,
 *   onChange?: (action: { upload: File } | { remove: true }) => Promise<void>,
 * }} options
 * @returns {HTMLElement | null}
 */
export function photoSlot({ path, version, label, hint, editable = false, small = false, onChange }) {
  if (!version && !editable) return null;
  const figure = h('figure', { class: small ? 'photo-slot photo-slot--small' : 'photo-slot' });
  if (version) {
    const img = h('img', { alt: label, class: 'photo-slot__image' });
    const link = h('a', { class: 'photo-slot__link', target: '_blank', rel: 'noopener', title: `Open: ${label}` }, img);
    figure.append(link);
    photoUrl(path, version)
      .then((url) => {
        img.src = url;
        link.href = url;
      })
      .catch(() => {
        figure.classList.add('photo-slot--missing');
        img.alt = `${label} (couldn’t load)`;
      });
  } else {
    figure.append(h('div', { class: 'photo-slot__empty', 'aria-hidden': 'true' }, '📷'));
  }
  figure.append(h('figcaption', null, label));
  if (hint && !version) figure.append(h('p', { class: 'photo-slot__hint' }, hint));
  if (editable && onChange) {
    const controls = h('div', { class: 'photo-slot__controls' });
    for (const pair of pickerButtons((file) => onChange({ upload: file }), Boolean(version))) {
      if (pair) controls.append(...pair);
    }
    if (version) {
      const remove = h('button', { type: 'button', class: 'secondary button--small' }, 'Remove photo');
      remove.addEventListener('click', () => onChange({ remove: true }));
      controls.append(remove);
    }
    figure.append(controls);
  }
  return figure;
}
