import type { UserRecord } from './users.repo.js';

/** Shape sent to the client — snake_case DB columns mapped to camelCase. */
export interface UserDto {
  telegramId: string;
  name: string | null;
  username: string | null;
  photoUrl: string | null;
  appLanguage: UserRecord['app_language'];
  /**
   * When Bixy first introduced itself (Part 05 §7), or null if it hasn't yet.
   *
   * Exposed because Part 07 §12's greeting now carries the introduction for a
   * brand-new student, and the greeting screen runs *before* the board. The
   * board's `POST /me/greeting` can't answer this for it: that endpoint stamps
   * `last_greeted_at` as a side effect, so asking it from the greeting screen
   * would burn the day-boundary greeting the board is about to show.
   */
  metAt: string | null;
}

export function toUserDto(user: UserRecord): UserDto {
  return {
    telegramId: user.telegram_id,
    name: user.name,
    username: user.username,
    photoUrl: user.photo_url,
    appLanguage: user.app_language,
    metAt: user.met_at ?? null,
  };
}
