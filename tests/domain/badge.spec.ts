import { expect, test } from "@playwright/test";
import {
  BADGE_VIEW_BOX,
  BASE_RANK_SILHOUETTES,
  badgeDescriptorForLevel,
} from "../../src/domain/badge-descriptor";
import { BASE_RANKS } from "../../src/domain/ranks";

const BASE_BADGE_RANKS = BASE_RANKS.slice(0, -1);

test("assigns a distinct base silhouette to every non-Marshal rank", () => {
  const descriptors = BASE_BADGE_RANKS.map((rank, rankIndex) => {
    const descriptor = badgeDescriptorForLevel(rankIndex * 5);

    expect(descriptor).toMatchObject({
      kind: "base-rank",
      rank,
      designation: null,
      viewBox: BADGE_VIEW_BOX,
      silhouette: BASE_RANK_SILHOUETTES[rank],
      pips: 0,
    });
    return descriptor;
  });

  expect(new Set(descriptors.map(({ silhouette }) => silhouette)).size).toBe(8);
  expect(badgeDescriptorForLevel(40)).toMatchObject({
    kind: "plain-marshal",
    rank: "Marshal",
    designation: null,
    silhouette: BASE_RANK_SILHOUETTES.Marshal,
  });
});

test("adds zero through four pips within every base-rank band", () => {
  for (let rankIndex = 0; rankIndex < BASE_BADGE_RANKS.length; rankIndex += 1) {
    const silhouette = BASE_RANK_SILHOUETTES[BASE_BADGE_RANKS[rankIndex]];

    for (let pips = 0; pips <= 4; pips += 1) {
      const descriptor = badgeDescriptorForLevel(rankIndex * 5 + pips);

      expect(descriptor.kind).toBe("base-rank");
      if (descriptor.kind !== "base-rank") {
        throw new Error("Expected a base-rank descriptor.");
      }
      expect(descriptor.silhouette).toBe(silhouette);
      expect(descriptor.pips).toBe(pips);
    }
  }
});

test("keeps plain Marshal and every Marshal descriptor pip-free", () => {
  for (const level of [40, 49, 50, 99, 100, 199, 200, 299, 300, 934]) {
    const descriptor = badgeDescriptorForLevel(level);

    expect("pips" in descriptor).toBe(false);
    expect(descriptor.silhouette).toBe(BASE_RANK_SILHOUETTES.Marshal);
  }
});

test("resolves cumulative Marshal segment counts without parsing a display title", () => {
  const expected = [
    { level: 50, designation: "Alfa", designationIndex: 0, segments: { core: 1, edge: 0, secondaryLayer: 0, outerFrame: 0, energyNodes: 0 } },
    { level: 60, designation: "Bravo", designationIndex: 1, segments: { core: 2, edge: 0, secondaryLayer: 0, outerFrame: 0, energyNodes: 0 } },
    { level: 99, designation: "Echo", designationIndex: 4, segments: { core: 5, edge: 0, secondaryLayer: 0, outerFrame: 0, energyNodes: 0 } },
    { level: 100, designation: "Foxtrot", designationIndex: 5, segments: { core: 5, edge: 1, secondaryLayer: 0, outerFrame: 0, energyNodes: 0 } },
    { level: 140, designation: "Juliett", designationIndex: 9, segments: { core: 5, edge: 5, secondaryLayer: 0, outerFrame: 0, energyNodes: 0 } },
    { level: 150, designation: "Kilo", designationIndex: 10, segments: { core: 5, edge: 5, secondaryLayer: 1, outerFrame: 0, energyNodes: 0 } },
    { level: 200, designation: "Papa", designationIndex: 15, segments: { core: 5, edge: 5, secondaryLayer: 5, outerFrame: 1, energyNodes: 0 } },
    { level: 250, designation: "Uniform", designationIndex: 20, segments: { core: 5, edge: 5, secondaryLayer: 5, outerFrame: 5, energyNodes: 1 } },
    { level: 290, designation: "Yankee", designationIndex: 24, segments: { core: 5, edge: 5, secondaryLayer: 5, outerFrame: 5, energyNodes: 5 } },
  ] as const;

  for (const sample of expected) {
    const descriptor = badgeDescriptorForLevel(sample.level);

    expect(descriptor).toMatchObject({
      kind: "phased-marshal",
      rank: "Marshal",
      designation: sample.designation,
      designationIndex: sample.designationIndex,
      segments: sample.segments,
    });
  }
});

test("clamps Zulu at level 300 and marks the final seal", () => {
  const levels = [300, 309, 310, 934, Number.MAX_SAFE_INTEGER];
  const descriptors = levels.map((level) => badgeDescriptorForLevel(level));

  for (const descriptor of descriptors) {
    expect(descriptor).toMatchObject({
      kind: "zulu",
      rank: "Marshal",
      designation: "Zulu",
      designationIndex: 25,
      finalSeal: true,
      segments: { core: 5, edge: 5, secondaryLayer: 5, outerFrame: 5, energyNodes: 5 },
    });
  }
  expect(descriptors[0]).toEqual(descriptors.at(-1));
});

test("returns equal frozen descriptors on every run", () => {
  const first = badgeDescriptorForLevel(100);
  const second = badgeDescriptorForLevel(100);

  expect(first).toEqual(second);
  expect(Object.isFrozen(first)).toBe(true);
  if (first.kind === "phased-marshal") {
    expect(Object.isFrozen(first.segments)).toBe(true);
  }
});

test("rejects invalid levels", () => {
  for (const level of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => badgeDescriptorForLevel(level)).toThrow();
  }
});
