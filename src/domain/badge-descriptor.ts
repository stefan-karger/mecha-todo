import { assertNonnegativeSafeInteger } from "./nonnegative-safe-integer";
import { BASE_RANKS, PRESTIGE_ATOMS, rankForLevel } from "./ranks";

export const BADGE_VIEW_BOX = "0 0 32 32" as const;

export const BASE_RANK_SILHOUETTES = {
  Cadet: "cadet-chevron",
  Trooper: "trooper-twin-chevron",
  Sergeant: "sergeant-stepped-chevron",
  Lieutenant: "lieutenant-diamond",
  Captain: "captain-double-diamond",
  Major: "major-winged-diamond",
  Colonel: "colonel-shield-bars",
  General: "general-star-wing",
  Marshal: "marshal-heavy-crest",
} as const;

export const PRESTIGE_MODIFIERS = {
  Prime: "central-notch",
  Vanguard: "forward-fins",
  Apex: "crown",
  Ascendant: "upper-spires",
  Sovereign: "side-bars",
  Stellar: "four-rays",
  Omega: "lower-hooks",
  Eternal: "outer-ring",
} as const;

export type BaseRank = (typeof BASE_RANKS)[number];
export type PrestigeAtom = (typeof PRESTIGE_ATOMS)[number];
export type BadgeSilhouette = (typeof BASE_RANK_SILHOUETTES)[BaseRank];
export type PrestigeModifier = (typeof PRESTIGE_MODIFIERS)[PrestigeAtom];
export type PipCount = 0 | 1 | 2 | 3 | 4;

export type BadgeDescriptor = Readonly<{
  viewBox: typeof BADGE_VIEW_BOX;
  silhouette: BadgeSilhouette;
  pips: PipCount;
  prestigeModifiers: readonly PrestigeModifier[];
  prestigeRemainderHash: number | null;
}>;

export function badgeDescriptor(level: number, canonicalRank: string): BadgeDescriptor {
  assertNonnegativeSafeInteger(level, "Level");

  const expectedRank = rankForLevel(level);
  if (canonicalRank !== expectedRank) {
    throw new RangeError("Canonical rank does not match the level.");
  }

  const rankIndex = Math.floor(level / 5);
  const baseRank = BASE_RANKS[rankIndex];
  const pips = (level % 5) as PipCount;

  if (baseRank !== undefined) {
    return Object.freeze({
      viewBox: BADGE_VIEW_BOX,
      silhouette: BASE_RANK_SILHOUETTES[baseRank],
      pips,
      prestigeModifiers: Object.freeze([]),
      prestigeRemainderHash: null,
    });
  }

  const atoms = canonicalRank
    .slice(0, -" Marshal".length)
    .split("-") as PrestigeAtom[];
  const prestigeModifiers = Object.freeze(
    atoms.slice(0, 2).map((atom) => PRESTIGE_MODIFIERS[atom]),
  );
  const remainder = atoms.slice(2);

  return Object.freeze({
    viewBox: BADGE_VIEW_BOX,
    silhouette: BASE_RANK_SILHOUETTES.Marshal,
    pips,
    prestigeModifiers,
    prestigeRemainderHash: remainder.length === 0 ? null : stablePrestigeHash(remainder),
  });
}

/**
 * Hashes prestige atoms with 32-bit FNV-1a. A unit-separator byte separates
 * the ASCII atom names. The unsigned result is stable across JavaScript runs.
 */
export function stablePrestigeHash(atoms: readonly PrestigeAtom[]): number {
  let hash = 0x811c9dc5;

  for (const character of atoms.join("\u001f")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}
