import { expect, test } from "@playwright/test";
import { BASE_RANKS, rankForLevel } from "../../src/domain/ranks";

test("uses every base rank for five levels", () => {
  for (const [rankIndex, rank] of BASE_RANKS.entries()) {
    const firstLevel = rankIndex * 5;

    expect(rankForLevel(firstLevel)).toBe(rank);
    expect(rankForLevel(firstLevel + 4)).toBe(rank);
  }
});

test("matches the required canonical rank samples", () => {
  expect(rankForLevel(0)).toBe("Cadet");
  expect(rankForLevel(5)).toBe("Trooper");
  expect(rankForLevel(40)).toBe("Marshal");
  expect(rankForLevel(45)).toBe("Prime Marshal");
  expect(rankForLevel(80)).toBe("Eternal Marshal");
  expect(rankForLevel(85)).toBe("Prime-Prime Marshal");
});

test("continues prestige ranks with complete bijective-base-8 atoms", () => {
  expect(rankForLevel(90)).toBe("Prime-Vanguard Marshal");
  expect(rankForLevel(360)).toBe("Omega-Eternal Marshal");
  expect(rankForLevel(365)).toBe("Eternal-Prime Marshal");
  expect(rankForLevel(400)).toBe("Eternal-Eternal Marshal");
  expect(rankForLevel(405)).toBe("Prime-Prime-Prime Marshal");
});

test("rejects invalid levels", () => {
  for (const level of [-1, 1.5, Number.NaN, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => rankForLevel(level)).toThrow(RangeError);
  }
});
