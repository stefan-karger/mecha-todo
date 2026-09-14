import { REWARD_RULES_V1 } from "../config/rules-v1";
import { assertNonnegativeSafeInteger } from "./nonnegative-safe-integer";

const XP_CURVE_EXPONENT =
  Math.log(REWARD_RULES_V1.todosAtLevel100 - 1) /
  Math.log(REWARD_RULES_V1.curveAnchorLevel - 1);

export type Progression = Readonly<{
  level: number;
  lifetimeXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progress: number;
}>;

export function totalXpForLevel(level: number): number {
  assertNonnegativeSafeInteger(level, "Level");

  if (level === 0) {
    return 0;
  }

  return Math.round(
    REWARD_RULES_V1.todoBaseXp * (1 + Math.pow(level - 1, XP_CURVE_EXPONENT)),
  );
}

export function levelForTotalXp(lifetimeXp: number): number {
  assertNonnegativeSafeInteger(lifetimeXp, "Lifetime XP");

  let lower = 0;
  let upper = 1;

  while (totalXpForLevel(upper) <= lifetimeXp) {
    lower = upper;
    upper *= 2;
  }

  while (lower + 1 < upper) {
    const candidate = lower + Math.floor((upper - lower) / 2);

    if (totalXpForLevel(candidate) <= lifetimeXp) {
      lower = candidate;
    } else {
      upper = candidate;
    }
  }

  return lower;
}

export function progressionForTotalXp(lifetimeXp: number): Progression {
  const level = levelForTotalXp(lifetimeXp);
  const currentLevelXp = totalXpForLevel(level);
  const nextLevelXp = totalXpForLevel(level + 1);
  const xpForCurrentLevel = lifetimeXp - currentLevelXp;
  const xpForNextLevel = nextLevelXp - currentLevelXp;
  const progress = Math.min(1, Math.max(0, xpForCurrentLevel / xpForNextLevel));

  return Object.freeze({
    level,
    lifetimeXp,
    currentLevelXp,
    nextLevelXp,
    xpForCurrentLevel,
    xpForNextLevel,
    progress,
  });
}
