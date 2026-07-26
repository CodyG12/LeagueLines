// Shared mascot sprites used as a fun alternative to a generic placeholder
// wherever a user or player prop has no real photo.
export const SPRITE_AVATARS = [
  "/sprites/creamy.svg",
  "/sprites/goldy.svg",
  "/sprites/indy.svg",
  "/sprites/John.svg",
  "/sprites/mustard.svg",
  "/sprites/purp.svg",
] as const;

export type SpriteAvatar = (typeof SPRITE_AVATARS)[number];

export function isSpriteAvatar(url: string | null): url is SpriteAvatar {
  return url !== null && (SPRITE_AVATARS as readonly string[]).includes(url);
}

// Deterministic pick based on a stable seed (e.g. a prop id) so the same
// entity always gets the same sprite instead of a new one on every render.
export function pickSpriteFor(seed: string): SpriteAvatar {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return SPRITE_AVATARS[hash % SPRITE_AVATARS.length];
}
