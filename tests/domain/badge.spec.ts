import { expect, test } from "@playwright/test";
import {
  BADGE_VIEW_BOX,
  BASE_RANK_SILHOUETTES,
  PRESTIGE_MODIFIERS,
  badgeDescriptor,
} from "../../src/domain/badge-descriptor";
import { BASE_RANKS, rankForLevel } from "../../src/domain/ranks";

test("assigns a distinct documented silhouette to every base rank", () => {
  const silhouettes = BASE_RANKS.map((rank, rankIndex) => {
    const descriptor = badgeDescriptor(rankIndex * 5, rank);

    expect(descriptor).toMatchObject({
      viewBox: BADGE_VIEW_BOX,
      silhouette: BASE_RANK_SILHOUETTES[rank],
      pips: 0,
      prestigeModifiers: [],
      prestigeRemainderHash: null,
    });
    return descriptor.silhouette;
  });

  expect(new Set(silhouettes).size).toBe(BASE_RANKS.length);
});

test("adds zero through four pips without changing a rank silhouette", () => {
  for (let pips = 0; pips <= 4; pips += 1) {
    const level = 20 + pips;
    const descriptor = badgeDescriptor(level, rankForLevel(level));

    expect(descriptor.silhouette).toBe(BASE_RANK_SILHOUETTES.Captain);
    expect(descriptor.pips).toBe(pips);
  }
});

test("keeps the Marshal silhouette and maps the first two prestige atoms", () => {
  expect(badgeDescriptor(45, "Prime Marshal")).toMatchObject({
    silhouette: BASE_RANK_SILHOUETTES.Marshal,
    prestigeModifiers: [PRESTIGE_MODIFIERS.Prime],
    prestigeRemainderHash: null,
  });
  expect(badgeDescriptor(80, "Eternal Marshal")).toMatchObject({
    silhouette: BASE_RANK_SILHOUETTES.Marshal,
    prestigeModifiers: [PRESTIGE_MODIFIERS.Eternal],
    prestigeRemainderHash: null,
  });
  expect(badgeDescriptor(85, "Prime-Prime Marshal")).toMatchObject({
    silhouette: BASE_RANK_SILHOUETTES.Marshal,
    prestigeModifiers: [PRESTIGE_MODIFIERS.Prime, PRESTIGE_MODIFIERS.Prime],
    prestigeRemainderHash: null,
  });
});

test("folds remaining repeated prestige atoms into a stable unsigned hash", () => {
  const descriptor = badgeDescriptor(405, "Prime-Prime-Prime Marshal");

  expect(descriptor.prestigeModifiers).toEqual([
    PRESTIGE_MODIFIERS.Prime,
    PRESTIGE_MODIFIERS.Prime,
  ]);
  expect(descriptor.prestigeRemainderHash).toBe(3_376_032_544);
});

test("keeps a fixed descriptor for a long canonical title", () => {
  const level = Number.MAX_SAFE_INTEGER;
  const canonicalRank = rankForLevel(level);
  const descriptor = badgeDescriptor(level, canonicalRank);

  expect(canonicalRank.length).toBeGreaterThan(100);
  expect(descriptor.viewBox).toBe("0 0 32 32");
  expect(descriptor.silhouette).toBe(BASE_RANK_SILHOUETTES.Marshal);
  expect(descriptor.prestigeModifiers).toHaveLength(2);
  expect(descriptor.prestigeRemainderHash).not.toBeNull();
});

test("returns equal frozen descriptors on every run", () => {
  const first = badgeDescriptor(405, rankForLevel(405));
  const second = badgeDescriptor(405, rankForLevel(405));

  expect(first).toEqual(second);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.prestigeModifiers)).toBe(true);
});

test("rejects a rank that does not match its level", () => {
  expect(() => badgeDescriptor(5, "Cadet")).toThrow("Canonical rank does not match the level.");
});
