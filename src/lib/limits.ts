// Input caps — applied at API boundaries to keep payloads bounded.
export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 280;
export const MAX_HINT = 120;
export const MAX_CATEGORY = 200;
export const MAX_HINTS_PER_ARTICLE = 30;
export const MAX_ALIAS = 200;
export const MAX_CUSTOM_ALIASES_PER_ARTICLE = 30;
export const MAX_CATEGORIES_PER_ARTICLE = 150;
export const MAX_ARTICLES_PER_SET = 200;
export const MAX_SETS_PER_OWNER = 50;
export const MAX_GUESS = 200;
export const MAX_PLAYER_NAME = 40;
export const MAX_PLAYERS = 12;
export const MAX_RESULTS = 200;

export function clampString(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}
