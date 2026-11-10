import { z } from 'zod';

/** An error whose status and message are safe to send to the client. */
export class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Sends HttpError messages as-is, validation errors as 400, and hides
 * everything else behind a generic 500 (logging only the error type).
 *
 * @type {import('express').ErrorRequestHandler}
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: 'Some of the details are missing or invalid.', issues: z.flattenError(err) });
    return;
  }
  // express.json() raises these for bad bodies.
  const status = /** @type {{ status?: number }} */ (err).status;
  if (status === 400 || status === 413) {
    res
      .status(status)
      .json({ error: status === 413 ? 'That request is too large.' : 'That request is not valid JSON.' });
    return;
  }
  console.error('Unhandled error:', err?.name ?? typeof err, err?.message);
  res.status(500).json({ error: 'Something went wrong at the North Pole.' });
}

/**
 * API responses are per-user and must never be cached.
 * @param {import('express').Request} _req @param {import('express').Response} res @param {import('express').NextFunction} next
 */
export function noStore(_req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  next();
}
