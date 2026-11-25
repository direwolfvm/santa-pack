import { z } from 'zod';
import { HttpError } from '../http.js';

/**
 * Framblywish (wish.santapack.me) is the family wish list. Both apps use the
 * same sign-in tenant, so we ask it with the person's own ID token and it
 * answers only with that person's data: the families they lead, and the gifts
 * they marked for Santa Pack. Neither app can read the other's database.
 */

const framblyId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const answer = z.object({
  families: z.array(
    z.object({
      id: framblyId,
      name: z.string(),
      people: z.array(z.object({ id: framblyId, name: z.string(), account: z.boolean() })),
    }),
  ),
  gifts: z.array(z.object({ id: framblyId, title: z.string(), recipientId: framblyId })),
});

/** The Santa Pack uid for someone Framblywish lists without an account. @param {string} id */
export const framblyGuestUid = (id) => `guest-fw-${id}`;

/** @param {{ baseUrl: string, fetchImpl?: typeof fetch }} deps */
export function createFramblywish({ baseUrl, fetchImpl = fetch }) {
  return {
    /** @param {string} authorization the caller's own Authorization header */
    async load(authorization) {
      try {
        const response = await fetchImpl(`${baseUrl}/api/santa-pack`, {
          headers: { Authorization: authorization },
          redirect: 'error', // never carry the token anywhere else
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error(`status ${response.status}`);
        return answer.parse(await response.json());
      } catch (error) {
        // Never the token or the reply, which holds gift titles.
        console.warn('Framblywish request failed:', error instanceof z.ZodError ? 'bad reply' : String(error));
        throw new HttpError(502, 'Framblywish could not be reached. Please try again later.');
      }
    },
  };
}

/** @typedef {ReturnType<typeof createFramblywish>} Framblywish */
