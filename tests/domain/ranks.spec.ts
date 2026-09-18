import { expect, test } from "@playwright/test";
import {
  BASE_RANKS,
  DESIGNATIONS,
  FINAL_DESIGNATION_LEVEL,
  FIRST_DESIGNATION_LEVEL,
  LEVELS_PER_BASE_RANK,
  LEVELS_PER_DESIGNATION,
  nextNamedMilestoneForLevel,
  progressionIdentityForLevel,
  rankForLevel,
} from "../../src/domain/ranks";

test("uses the canonical base-rank order and boundaries", () => {
  expect(BASE_RANKS).toEqual([
    "Cadet",
    "Specialist",
    "Sergeant",
    "Lieutenant",
    "Captain",
    "Major",
    "Colonel",
    "General",
    "Marshal",
  ]);

  for (const [rankIndex, rank] of BASE_RANKS.entries()) {
    const firstLevel = rankIndex * LEVELS_PER_BASE_RANK;
    const lastLevel = rank === "Marshal" ? FIRST_DESIGNATION_LEVEL - 1 : firstLevel + 4;
    const first = progressionIdentityForLevel(firstLevel);
    const last = progressionIdentityForLevel(lastLevel);

    expect(first.rank, `first level of ${rank}`).toBe(rank);
    expect(last.rank, `last level of ${rank}`).toBe(rank);
    expect(first.designation, `first designation of ${rank}`).toBeNull();
    expect(last.designation, `last designation of ${rank}`).toBeNull();
  }
});

test("uses the complete official designation order and boundaries", () => {
  expect(DESIGNATIONS).toEqual([
    "Alfa",
    "Bravo",
    "Charlie",
    "Delta",
    "Echo",
    "Foxtrot",
    "Golf",
    "Hotel",
    "India",
    "Juliett",
    "Kilo",
    "Lima",
    "Mike",
    "November",
    "Oscar",
    "Papa",
    "Quebec",
    "Romeo",
    "Sierra",
    "Tango",
    "Uniform",
    "Victor",
    "Whiskey",
    "X-ray",
    "Yankee",
    "Zulu",
  ]);

  for (const [designationIndex, designation] of DESIGNATIONS.entries()) {
    const firstLevel = FIRST_DESIGNATION_LEVEL + designationIndex * LEVELS_PER_DESIGNATION;
    const lastLevel = firstLevel + LEVELS_PER_DESIGNATION - 1;

    for (const level of [firstLevel, lastLevel]) {
      expect(progressionIdentityForLevel(level), `level ${level}`).toEqual({
        rank: "Marshal",
        designation,
      });
    }
  }
});

test("clamps Zulu at LV 300 and keeps it for later levels", () => {
  expect(FINAL_DESIGNATION_LEVEL).toBe(300);

  for (const level of [300, 309, 310, 934, 1_000_000]) {
    expect(progressionIdentityForLevel(level), `level ${level}`).toEqual({
      rank: "Marshal",
      designation: "Zulu",
    });
    expect(nextNamedMilestoneForLevel(level), `milestone after ${level}`).toBeNull();
  }
});

test("derives the next named milestone at each progression boundary", () => {
  expect(nextNamedMilestoneForLevel(0)).toEqual({ kind: "rank", rank: "Specialist", level: 5 });
  expect(nextNamedMilestoneForLevel(4)).toEqual({ kind: "rank", rank: "Specialist", level: 5 });
  expect(nextNamedMilestoneForLevel(5)).toEqual({ kind: "rank", rank: "Sergeant", level: 10 });
  expect(nextNamedMilestoneForLevel(39)).toEqual({ kind: "rank", rank: "Marshal", level: 40 });
  expect(nextNamedMilestoneForLevel(40)).toEqual({
    kind: "designation",
    designation: "Alfa",
    level: 50,
  });
  expect(nextNamedMilestoneForLevel(49)).toEqual({
    kind: "designation",
    designation: "Alfa",
    level: 50,
  });
  expect(nextNamedMilestoneForLevel(50)).toEqual({
    kind: "designation",
    designation: "Bravo",
    level: 60,
  });
  expect(nextNamedMilestoneForLevel(290)).toEqual({
    kind: "designation",
    designation: "Zulu",
    level: 300,
  });
  expect(nextNamedMilestoneForLevel(299)).toEqual({
    kind: "designation",
    designation: "Zulu",
    level: 300,
  });
});

test("keeps the old display adapter working until UI integration moves", () => {
  expect(rankForLevel(0)).toBe("Cadet");
  expect(rankForLevel(5)).toBe("Specialist");
  expect(rankForLevel(40)).toBe("Marshal");
  expect(rankForLevel(45)).toBe("Prime Marshal");
  expect(rankForLevel(50)).toBe("Vanguard Marshal");
  expect(rankForLevel(1_000_000)).toContain("Marshal");
});

test("rejects invalid levels for every taxonomy API", () => {
  const invalidLevels = [
    -1,
    1.5,
    Number.NaN,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ];

  for (const level of invalidLevels) {
    expect(() => progressionIdentityForLevel(level), `identity ${level}`).toThrow(RangeError);
    expect(() => nextNamedMilestoneForLevel(level), `milestone ${level}`).toThrow(RangeError);
    expect(() => rankForLevel(level), `rank ${level}`).toThrow(RangeError);
  }
});
