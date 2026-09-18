import { expect, test } from "@playwright/test";
import {
  ACTIVE_CAPACITY_LEVELS_PER_STEP,
  activeCapacity,
} from "../../src/domain/capacity";
import { REWARD_RULES_V1 } from "../../src/config/rules-v1";

test("owns its level step independently from award rules", () => {
  expect(ACTIVE_CAPACITY_LEVELS_PER_STEP).toBe(5);
  expect(REWARD_RULES_V1).not.toHaveProperty("levelsPerRank");
});

test("increases Active Bay capacity every five levels through the cap", () => {
  const boundaries = [
    [0, 8],
    [4, 8],
    [5, 9],
    [9, 9],
    [10, 10],
    [14, 10],
    [15, 11],
    [19, 11],
    [20, 12],
    [24, 12],
    [25, 13],
    [29, 13],
    [30, 14],
    [34, 14],
    [35, 15],
    [39, 15],
    [40, 16],
    [1_000, 16],
  ] as const;

  for (const [level, capacity] of boundaries) {
    expect(activeCapacity(level), `level ${level}`).toBe(capacity);
  }
});

test("rejects invalid levels", () => {
  for (const level of [-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => activeCapacity(level)).toThrow(RangeError);
  }
});
