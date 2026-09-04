import type { ErrorRequestHandler } from 'express';

/**
 * Last-resort error handler: logs the real error server-side and returns a
 * generic JSON 500 so we never leak internals to the client. Combined with
 * `express-async-errors`, this also catches rejections thrown in async routes,
 * which Express 4 otherwise drops (leaving the request hanging).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal_error' });
};
