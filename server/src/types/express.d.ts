// Attaches the authenticated Telegram user id to the request once requireAuth
// has verified the session token.
declare global {
  namespace Express {
    interface Request {
      telegramId?: string;
    }
  }
}

export {};
