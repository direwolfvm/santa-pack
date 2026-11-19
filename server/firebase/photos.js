/**
 * Present photos in a private Cloud Storage bucket. Nothing here decides who
 * may see a photo: the API checks projectPresent / photoActionError first,
 * and the browser loads photos through the API with its sign-in token. The
 * bucket itself is never public.
 *
 * Objects live at families/{familyId}/rounds/{roundId}/presents/{presentId}/{kind},
 * so deleting a family, round or present can remove its photos by prefix.
 *
 * @typedef {import('../game/rules.js').PhotoKind} PhotoKind
 */

export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

/** Identify an image by its leading bytes; the uploader's claim is ignored. @param {unknown} data */
export function sniffImage(data) {
  // Request bodies can be strings, arrays or objects; only raw bytes are photos.
  if (typeof data === 'string' || Array.isArray(data) || !Buffer.isBuffer(data) || data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data[0] === 0x89 && data.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (data.toString('latin1', 0, 4) === 'RIFF' && data.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** @param {{ familyId: string }} family @param {{ id: string }} [round] @param {{ id: string }} [present] */
export function photoPrefix(family, round, present) {
  let prefix = `families/${family.familyId}/`;
  if (round) prefix += `rounds/${round.id}/`;
  if (present) prefix += `presents/${present.id}/`;
  return prefix;
}

/** @param {import('../game/rules.js').Present} present @param {PhotoKind} kind */
const objectPath = (present, kind) => `${photoPrefix(present, { id: present.roundId }, present)}${kind}`;

/** @param {ReturnType<import('firebase-admin/storage').Storage['bucket']>} bucket */
export function createPhotoStore(bucket) {
  return {
    /** @param {import('../game/rules.js').Present} present @param {PhotoKind} kind @param {Buffer} data @param {string} contentType */
    async save(present, kind, data, contentType) {
      await bucket.file(objectPath(present, kind)).save(data, { contentType, resumable: false });
    },

    /** @param {import('../game/rules.js').Present} present @param {PhotoKind} kind */
    async read(present, kind) {
      try {
        const [data] = await bucket.file(objectPath(present, kind)).download();
        const contentType = sniffImage(data);
        return contentType ? { data, contentType } : null;
      } catch (error) {
        if (/** @type {{ code?: number }} */ (error)?.code === 404) return null;
        throw error;
      }
    },

    /** @param {import('../game/rules.js').Present} present @param {PhotoKind} kind */
    async remove(present, kind) {
      await bucket.file(objectPath(present, kind)).delete({ ignoreNotFound: true });
    },

    /** Remove everything under a prefix from photoPrefix(). Failures are logged, not thrown. @param {string} prefix */
    async removeAll(prefix) {
      try {
        await bucket.deleteFiles({ prefix, force: true });
      } catch (error) {
        console.error('Photo cleanup failed:', /** @type {Error} */ (error)?.message);
      }
    },
  };
}

/** @typedef {ReturnType<typeof createPhotoStore>} PhotoStore */
