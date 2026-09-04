import type { UserRecord } from './users.repo';

/** Shape sent to the client — snake_case DB columns mapped to camelCase. */
export interface UserDto {
  telegramId: string;
  name: string | null;
  username: string | null;
  photoUrl: string | null;
  appLanguage: UserRecord['app_language'];
}

export function toUserDto(user: UserRecord): UserDto {
  return {
    telegramId: user.telegram_id,
    name: user.name,
    username: user.username,
    photoUrl: user.photo_url,
    appLanguage: user.app_language,
  };
}
