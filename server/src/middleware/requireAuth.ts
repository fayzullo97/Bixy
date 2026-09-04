import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Session } from '../modules/auth/session';

/**
 * Gate for authenticated routes. Expects `Authorization: Bearer <session>`,
 * verifies it, and stashes the Telegram user id on the request. Anything past
 * this middleware can trust `req.telegramId`.
 */
export function requireAuth(session: Session): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    try {
      req.telegramId = await session.verify(token);
      next();
    } catch {
      res.status(401).json({ error: 'invalid_session' });
    }
  };
}
