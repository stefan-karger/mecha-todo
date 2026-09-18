import { expect, test } from "@playwright/test";
import { badgeDescriptorForLevel } from "../../src/domain/badge-descriptor";
import { renderRankBadgeSvg } from "../../src/app/RankBadge";
import { BADGE_GEOMETRY } from "../../src/app/badge-geometry";

function polygons(markup: string): number[][][] {
  return [...markup.matchAll(/points="([^"]+)"/g)].map((match) =>
    match[1].split(" ").map((point) => point.split(",").map(Number)),
  );
}

test("constructs separate matching chevrons and vertically stacked filled diamonds", () => {
  for (const [name, count] of [
    ["cadet-chevron", 1], ["specialist-twin-chevron", 2], ["sergeant-triple-chevron", 3],
  ] as const) {
    const bands = polygons(BADGE_GEOMETRY[name]);
    expect(bands).toHaveLength(count);
    for (const band of bands) {
      expect(band).toHaveLength(6);
      expect(band.map(([x]) => x)).toEqual(bands[0].map(([x]) => x));
      // Same band shape translated vertically, not a taper or connected staircase.
      expect(band.map(([, y]) => Math.round((y - band[0][1]) * 10))).toEqual(
        bands[0].map(([, y]) => Math.round((y - bands[0][0][1]) * 10)),
      );
    }
  }
  const diamonds = polygons(BADGE_GEOMETRY["captain-double-diamond"]);
  expect(diamonds).toHaveLength(2);
  expect(diamonds[0].map(([x]) => x)).toEqual(diamonds[1].map(([x]) => x));
  expect(Math.max(...diamonds[0].map(([, y]) => y))).toBeLessThan(
    Math.min(...diamonds[1].map(([, y]) => y)),
  );
  expect(BADGE_GEOMETRY["captain-double-diamond"]).not.toContain("evenodd");
  expect(polygons(BADGE_GEOMETRY["lieutenant-diamond"])).toHaveLength(1);
  expect(polygons(BADGE_GEOMETRY["lieutenant-diamond"])[0]).toHaveLength(4);
  expect(polygons(BADGE_GEOMETRY["major-winged-diamond"])[0]).toHaveLength(4);
  expect(BADGE_GEOMETRY["lieutenant-diamond"]).not.toContain("evenodd");
});

test("preserves wing tiers, Colonel's internal bars, and General's five-point star", () => {
  expect(polygons(BADGE_GEOMETRY["major-winged-diamond"])).toHaveLength(7);
  expect(polygons(BADGE_GEOMETRY["general-star-wing"])).toHaveLength(7);
  expect(polygons(BADGE_GEOMETRY["colonel-hexagon-bars"])).toHaveLength(3);
  expect(BADGE_GEOMETRY["colonel-hexagon-bars"]).toContain('fill-rule="evenodd"');
  const star = polygons(BADGE_GEOMETRY["general-star-wing"])[0];
  // Ten alternating outer/inner vertices give five tips, not the old six-point burst.
  expect(star).toHaveLength(10);
  expect(BADGE_GEOMETRY["general-star-wing"]).not.toContain("evenodd");
  expect(polygons(BADGE_GEOMETRY["marshal-heavy-crest"])).toHaveLength(6);
  const centerBar = polygons(BADGE_GEOMETRY["colonel-hexagon-bars"])[0];
  expect(centerBar).toHaveLength(6);
  expect(centerBar[0][0]).toBe(centerBar[3][0]);
  for (const sideBar of polygons(BADGE_GEOMETRY["colonel-hexagon-bars"]).slice(1)) {
    expect(sideBar[1][1]).toBeLessThan(sideBar[0][1]);
    expect(sideBar[2][1]).toBeGreaterThan(sideBar[3][1]);
  }
  for (const markup of Object.values(BADGE_GEOMETRY)) {
    expect(markup).not.toMatch(/stroke=|fill="(?!currentColor)|<rect|<filter|<image|<text/);
  }
  expect(new Set(Object.values(BADGE_GEOMETRY)).size).toBe(9);
});

test("renders every base silhouette and pip state in one deterministic view box", () => {
  const levels = Array.from({ length: 40 }, (_, level) => level);
  const output = levels.map((level) => ({
    level,
    svg: renderRankBadgeSvg(badgeDescriptorForLevel(level)),
  }));

  expect(JSON.stringify(output, null, 2)).toMatchSnapshot("base-ranks-and-pips.txt");
  expect(new Set(output.map(({ svg }) => svg.slice(svg.indexOf("<g")))).size).toBe(40);

  for (const { level, svg } of output) {
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).not.toContain("crispEdges");
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain(`data-pips="${level % 5}"`);
    expect(svg.match(/<rect/g)?.length ?? 0).toBe(level % 5);
  }
});

test("renders every Marshal state without pips and stays deterministic after Zulu", () => {
  const levels = [40, 49, 50, 60, 99, 100, 140, 150, 200, 250, 290, 300, 301, 934];
  const firstRun = levels.map((level) => ({
    level,
    svg: renderRankBadgeSvg(badgeDescriptorForLevel(level)),
  }));
  const secondRun = levels.map((level) => ({
    level,
    svg: renderRankBadgeSvg(badgeDescriptorForLevel(level)),
  }));

  expect(firstRun).toEqual(secondRun);
  expect(JSON.stringify(firstRun, null, 2)).toMatchSnapshot("marshal-states.txt");
  expect(firstRun.find(({ level }) => level === 300)?.svg).toBe(
    firstRun.find(({ level }) => level === 934)?.svg,
  );

  for (const { svg } of firstRun) {
    expect(svg.match(/viewBox=/g)).toHaveLength(1);
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('data-silhouette="marshal-heavy-crest"');
    expect(svg).not.toContain("data-pips");
    expect(svg).not.toContain("<rect");
  }
});
