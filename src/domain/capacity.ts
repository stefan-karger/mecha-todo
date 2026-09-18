import { assertNonnegativeSafeInteger } from "./nonnegative-safe-integer";

export const INITIAL_ACTIVE_CAPACITY = 8;
export const MAX_ACTIVE_CAPACITY = 16;
export const ACTIVE_CAPACITY_LEVELS_PER_STEP = 5;

export function activeCapacity(level: number): number {
  assertNonnegativeSafeInteger(level, "Level");

  return Math.min(
    INITIAL_ACTIVE_CAPACITY + Math.floor(level / ACTIVE_CAPACITY_LEVELS_PER_STEP),
    MAX_ACTIVE_CAPACITY,
  );
}
