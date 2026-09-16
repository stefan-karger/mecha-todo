import { expect, test } from "@playwright/test";
import { badgeDescriptor } from "../../src/domain/badge-descriptor";
import { rankForLevel } from "../../src/domain/ranks";
import { renderRankBadgeSvg } from "../../src/app/RankBadge";

test("renders every base silhouette and pip state as deterministic fixed-view-box SVG", () => {
  const levels = [
    0, 5, 10, 15, 20, 25, 30, 35, 40,
    41, 42, 43, 44,
  ];
  const output = levels.map((level) => {
    const rank = rankForLevel(level);
    return { level, rank, svg: renderRankBadgeSvg(badgeDescriptor(level, rank)) };
  });

  expect(JSON.stringify(output, null, 2)).toMatchSnapshot("base-ranks-and-pips.txt");
  expect(new Set(output.slice(0, 9).map(({ svg }) => svg)).size).toBe(9);
  for (const { svg } of output) {
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('aria-hidden="true"');
  }
});

test("keeps repeated prestige atoms and long titles deterministic inside the same view box", () => {
  const levels = [45, 80, 85, 725, 5_000];
  const firstRun = levels.map((level) => {
    const rank = rankForLevel(level);
    return { level, rank, svg: renderRankBadgeSvg(badgeDescriptor(level, rank)) };
  });
  const secondRun = levels.map((level) => {
    const rank = rankForLevel(level);
    return { level, rank, svg: renderRankBadgeSvg(badgeDescriptor(level, rank)) };
  });

  expect(firstRun).toEqual(secondRun);
  expect(JSON.stringify(firstRun, null, 2)).toMatchSnapshot("prestige-ranks.txt");
  expect(firstRun[2]?.rank).toBe("Prime-Prime Marshal");
  expect(firstRun.at(-1)?.rank.length).toBeGreaterThan(20);
  for (const { svg } of firstRun) {
    expect(svg.match(/viewBox=/g)).toHaveLength(1);
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('data-silhouette="marshal-heavy-crest"');
  }
});
