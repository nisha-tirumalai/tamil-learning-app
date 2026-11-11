// Your avatar (spec 003): the character that stands for you in the chat.
// null in the database = not chosen yet.

export const AVATARS = ["girl", "guy"] as const;
export type Avatar = (typeof AVATARS)[number];

export const AVATAR_LABELS: Record<Avatar, string> = { girl: "Girl", guy: "Guy" };

export function isAvatar(value: unknown): value is Avatar {
  return AVATARS.includes(value as Avatar);
}

/** Where the picker may send you afterwards (never an address from outside). */
export function afterChoosing(next: unknown): "/" | "/settings" {
  return next === "/settings" ? "/settings" : "/";
}
