import { assertNonnegativeSafeInteger } from "./nonnegative-safe-integer";
import {
  DESIGNATIONS,
  LEVELS_PER_BASE_RANK,
  progressionIdentityForLevel,
  type BaseRank as ProgressionBaseRank,
} from "./ranks";

export const BADGE_VIEW_BOX = "0 0 32 32" as const;

export const BASE_RANK_SILHOUETTES = {
  Cadet: "cadet-chevron",
  Specialist: "specialist-twin-chevron",
  Sergeant: "sergeant-triple-chevron",
  Lieutenant: "lieutenant-diamond",
  Captain: "captain-double-diamond",
  Major: "major-winged-diamond",
  Colonel: "colonel-hexagon-bars",
  General: "general-star-wing",
  Marshal: "marshal-heavy-crest",
} as const;

export type BaseRank = ProgressionBaseRank;
export type NonMarshalRank = Exclude<BaseRank, "Marshal">;
export type Designation = (typeof DESIGNATIONS)[number];
export type BadgeSilhouette = (typeof BASE_RANK_SILHOUETTES)[BaseRank];
export type PipCount = 0 | 1 | 2 | 3 | 4;
export type SegmentCount = 0 | 1 | 2 | 3 | 4 | 5;

type BadgeFrame = Readonly<{
  viewBox: typeof BADGE_VIEW_BOX;
  silhouette: BadgeSilhouette;
}>;

type BaseRankBadgeDescriptor = Readonly<
  BadgeFrame & {
    kind: "base-rank";
    rank: NonMarshalRank;
    designation: null;
    silhouette: Exclude<BadgeSilhouette, typeof BASE_RANK_SILHOUETTES.Marshal>;
    pips: PipCount;
  }
>;

export type MarshalSegments = Readonly<{
  core: SegmentCount;
  edge: SegmentCount;
  secondaryLayer: SegmentCount;
  outerFrame: SegmentCount;
  energyNodes: SegmentCount;
}>;

export type PlainMarshalBadgeDescriptor = Readonly<
  BadgeFrame & {
    kind: "plain-marshal";
    rank: "Marshal";
    designation: null;
    silhouette: typeof BASE_RANK_SILHOUETTES.Marshal;
  }
>;

export type PhasedMarshalBadgeDescriptor = Readonly<
  BadgeFrame & {
    kind: "phased-marshal";
    rank: "Marshal";
    designation: Exclude<Designation, "Zulu">;
    designationIndex: number;
    segments: MarshalSegments;
    silhouette: typeof BASE_RANK_SILHOUETTES.Marshal;
  }
>;

export type ZuluBadgeDescriptor = Readonly<
  BadgeFrame & {
    kind: "zulu";
    rank: "Marshal";
    designation: "Zulu";
    designationIndex: 25;
    finalSeal: true;
    segments: MarshalSegments;
    silhouette: typeof BASE_RANK_SILHOUETTES.Marshal;
  }
>;

export type BadgeDescriptor =
  | BaseRankBadgeDescriptor
  | PlainMarshalBadgeDescriptor
  | PhasedMarshalBadgeDescriptor
  | ZuluBadgeDescriptor;

const FULL_MARSHAL_SEGMENTS: MarshalSegments = Object.freeze({
  core: 5,
  edge: 5,
  secondaryLayer: 5,
  outerFrame: 5,
  energyNodes: 5,
});

/**
 * Derive the badge state from the numeric level. The descriptor carries the
 * resolved state so the renderer never needs to parse a display title.
 */
export function badgeDescriptorForLevel(level: number): BadgeDescriptor {
  assertNonnegativeSafeInteger(level, "Level");

  const identity = progressionIdentityForLevel(level);
  if (identity.rank !== "Marshal") {
    return Object.freeze({
      kind: "base-rank",
      rank: identity.rank,
      designation: null,
      viewBox: BADGE_VIEW_BOX,
      silhouette: BASE_RANK_SILHOUETTES[identity.rank],
      pips: (level % LEVELS_PER_BASE_RANK) as PipCount,
    });
  }

  if (identity.designation === null) {
    return Object.freeze({
      kind: "plain-marshal",
      rank: "Marshal",
      designation: null,
      viewBox: BADGE_VIEW_BOX,
      silhouette: BASE_RANK_SILHOUETTES.Marshal,
    });
  }

  const designationIndex = DESIGNATIONS.indexOf(identity.designation);
  if (designationIndex < 0) {
    throw new RangeError("Marshal designation is not in the canonical order.");
  }

  if (identity.designation === "Zulu") {
    return Object.freeze({
      kind: "zulu",
      rank: "Marshal",
      designation: "Zulu",
      designationIndex: 25,
      finalSeal: true,
      segments: FULL_MARSHAL_SEGMENTS,
      viewBox: BADGE_VIEW_BOX,
      silhouette: BASE_RANK_SILHOUETTES.Marshal,
    });
  }

  return Object.freeze({
    kind: "phased-marshal",
    rank: "Marshal",
    designation: identity.designation,
    designationIndex,
    segments: marshalSegmentsForDesignationIndex(designationIndex),
    viewBox: BADGE_VIEW_BOX,
    silhouette: BASE_RANK_SILHOUETTES.Marshal,
  });
}

/**
 * Transitional name for callers that already consume a level-only badge API.
 */
export const badgeDescriptor = badgeDescriptorForLevel;

function marshalSegmentsForDesignationIndex(designationIndex: number): MarshalSegments {
  const phaseIndex = Math.floor(designationIndex / 5);
  const phaseStep = (designationIndex % 5) + 1;

  return Object.freeze({
    core: segmentCount(phaseIndex === 0 ? phaseStep : 5),
    edge: segmentCount(phaseIndex < 1 ? 0 : phaseIndex === 1 ? phaseStep : 5),
    secondaryLayer: segmentCount(phaseIndex < 2 ? 0 : phaseIndex === 2 ? phaseStep : 5),
    outerFrame: segmentCount(phaseIndex < 3 ? 0 : phaseIndex === 3 ? phaseStep : 5),
    energyNodes: segmentCount(phaseIndex < 4 ? 0 : phaseIndex === 4 ? phaseStep : 5),
  });
}

function segmentCount(value: number): SegmentCount {
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new RangeError("Marshal segment count must be an integer from zero through five.");
  }

  return value as SegmentCount;
}
