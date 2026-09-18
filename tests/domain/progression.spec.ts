import { expect, test } from "@playwright/test";
import {
  levelForTotalXp,
  progressionForTotalXp,
  totalXpForLevel,
} from "../../src/domain/progression";

const referenceThresholds = new Map([
  [0, 0],
  [1, 10],
  [2, 20],
  [3, 36],
  [4, 54],
  [5, 75],
  [10, 205],
  [20, 546],
  [50, 1_938],
  [100, 5_000],
  [300, 22_249],
  [1_000, 113_620],
]);

test("matches every reference threshold", () => {
  for (const [level, lifetimeXp] of referenceThresholds) {
    expect(totalXpForLevel(level), `level ${level}`).toBe(lifetimeXp);
  }
});

test("finds exact levels and the XP before their next threshold through level 1,000", () => {
  for (let level = 0; level <= 1_000; level += 1) {
    const threshold = totalXpForLevel(level);
    const nextThreshold = totalXpForLevel(level + 1);

    expect(levelForTotalXp(threshold), `threshold for level ${level}`).toBe(level);
    expect(levelForTotalXp(nextThreshold - 1), `end of level ${level}`).toBe(level);
  }
});

test("reports current-level numerator, denominator, and a clamped fraction", () => {
  expect(progressionForTotalXp(66)).toEqual({
    level: 4,
    lifetimeXp: 66,
    currentLevelXp: 54,
    nextLevelXp: 75,
    xpForCurrentLevel: 12,
    xpForNextLevel: 21,
    progress: 12 / 21,
  });
  expect(progressionForTotalXp(0).progress).toBe(0);
  expect(progressionForTotalXp(totalXpForLevel(1_000) - 1).progress).toBeGreaterThanOrEqual(0);
  expect(progressionForTotalXp(totalXpForLevel(1_000) - 1).progress).toBeLessThanOrEqual(1);
});

test("rejects invalid level and Lifetime XP inputs", () => {
  const invalidInputs = [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];

  for (const value of invalidInputs) {
    expect(() => totalXpForLevel(value), `level ${value}`).toThrow(RangeError);
    expect(() => levelForTotalXp(value), `Lifetime XP ${value}`).toThrow(RangeError);
    expect(() => progressionForTotalXp(value), `progression ${value}`).toThrow(RangeError);
  }
});
