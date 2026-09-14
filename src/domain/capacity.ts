import { assertNonnegativeSafeInteger } from "./nonnegative-safe-integer";

export const INITIAL_ACTIVE_CAPACITY = 8;
export const MAX_ACTIVE_CAPACITY = 16;

export function activeCapacity(level: number): number {
  assertNonnegativeSafeInteger(level, "Level");

  return Math.min(INITIAL_ACTIVE_CAPACITY + Math.floor(level / 5), MAX_ACTIVE_CAPACITY);
}
