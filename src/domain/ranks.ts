import { REWARD_RULES_V1 } from "../config/rules-v1";
import { assertNonnegativeSafeInteger } from "./nonnegative-safe-integer";

export const BASE_RANKS = [
  "Cadet",
  "Trooper",
  "Sergeant",
  "Lieutenant",
  "Captain",
  "Major",
  "Colonel",
  "General",
  "Marshal",
] as const;

export const PRESTIGE_ATOMS = [
  "Prime",
  "Vanguard",
  "Apex",
  "Ascendant",
  "Sovereign",
  "Stellar",
  "Omega",
  "Eternal",
] as const;

export function rankForLevel(level: number): string {
  assertNonnegativeSafeInteger(level, "Level");

  const rankIndex = Math.floor(level / REWARD_RULES_V1.levelsPerRank);
  const baseRank = BASE_RANKS[rankIndex];

  if (baseRank !== undefined) {
    return baseRank;
  }

  const prestigeOrdinal = rankIndex - BASE_RANKS.length + 1;
  const atoms: string[] = [];
  let remainder = prestigeOrdinal;

  while (remainder > 0) {
    remainder -= 1;
    atoms.unshift(PRESTIGE_ATOMS[remainder % PRESTIGE_ATOMS.length]);
    remainder = Math.floor(remainder / PRESTIGE_ATOMS.length);
  }

  return `${atoms.join("-")} Marshal`;
}
