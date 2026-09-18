import { assertNonnegativeSafeInteger } from "./nonnegative-safe-integer";

export const LEVELS_PER_BASE_RANK = 5 as const;
export const MARSHAL_LEVEL = 40 as const;
export const FIRST_DESIGNATION_LEVEL = 50 as const;
export const LEVELS_PER_DESIGNATION = 10 as const;
export const FINAL_DESIGNATION_LEVEL = 300 as const;

export const BASE_RANKS = [
  "Cadet",
  "Specialist",
  "Sergeant",
  "Lieutenant",
  "Captain",
  "Major",
  "Colonel",
  "General",
  "Marshal",
] as const;

export const DESIGNATIONS = [
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
] as const;

export type BaseRank = (typeof BASE_RANKS)[number];
export type NonMarshalRank = Exclude<BaseRank, "Marshal">;
export type Designation = (typeof DESIGNATIONS)[number];

export type ProgressionIdentity =
  | Readonly<{
      rank: NonMarshalRank;
      designation: null;
    }>
  | Readonly<{
      rank: "Marshal";
      designation: Designation | null;
    }>;

export type NamedMilestone =
  | Readonly<{ kind: "rank"; rank: BaseRank; level: number }>
  | Readonly<{ kind: "designation"; designation: Designation; level: number }>;

const LEGACY_PRESTIGE_ATOMS = [
  "Prime",
  "Vanguard",
  "Apex",
  "Ascendant",
  "Sovereign",
  "Stellar",
  "Omega",
  "Eternal",
] as const;

export function progressionIdentityForLevel(level: number): ProgressionIdentity {
  assertNonnegativeSafeInteger(level, "Level");

  if (level < MARSHAL_LEVEL) {
    const rank = BASE_RANKS[Math.floor(level / LEVELS_PER_BASE_RANK)];

    if (rank === undefined || rank === "Marshal") {
      throw new RangeError("Level does not map to a non-Marshal rank.");
    }

    return Object.freeze({ rank, designation: null });
  }

  if (level < FIRST_DESIGNATION_LEVEL) {
    return Object.freeze({ rank: "Marshal", designation: null });
  }

  const designationIndex =
    level >= FINAL_DESIGNATION_LEVEL
      ? DESIGNATIONS.length - 1
      : Math.floor((level - FIRST_DESIGNATION_LEVEL) / LEVELS_PER_DESIGNATION);

  return Object.freeze({
    rank: "Marshal",
    designation: DESIGNATIONS[designationIndex],
  });
}

export function nextNamedMilestoneForLevel(level: number): NamedMilestone | null {
  assertNonnegativeSafeInteger(level, "Level");

  if (level < MARSHAL_LEVEL) {
    const nextRankIndex = Math.floor(level / LEVELS_PER_BASE_RANK) + 1;
    const rank = BASE_RANKS[nextRankIndex];

    if (rank === undefined) {
      throw new RangeError("Level does not map to a next base rank.");
    }

    return Object.freeze({
      kind: "rank",
      rank,
      level: nextRankIndex * LEVELS_PER_BASE_RANK,
    });
  }

  if (level < FIRST_DESIGNATION_LEVEL) {
    return Object.freeze({
      kind: "designation",
      designation: DESIGNATIONS[0],
      level: FIRST_DESIGNATION_LEVEL,
    });
  }

  if (level >= FINAL_DESIGNATION_LEVEL) {
    return null;
  }

  const currentDesignationIndex = Math.floor(
    (level - FIRST_DESIGNATION_LEVEL) / LEVELS_PER_DESIGNATION,
  );
  const nextDesignationIndex = currentDesignationIndex + 1;

  if (nextDesignationIndex >= DESIGNATIONS.length) {
    return null;
  }

  return Object.freeze({
    kind: "designation",
    designation: DESIGNATIONS[nextDesignationIndex],
    level: FIRST_DESIGNATION_LEVEL + nextDesignationIndex * LEVELS_PER_DESIGNATION,
  });
}

/**
 * Transitional display adapter for callers that have not moved to the
 * structured progression identity yet. It preserves the old string shape
 * until the application integration ticket replaces those consumers.
 */
export function rankForLevel(level: number): string {
  assertNonnegativeSafeInteger(level, "Level");

  const identity = progressionIdentityForLevel(level);
  if (identity.rank !== "Marshal") {
    return identity.rank;
  }

  const rankIndex = Math.floor(level / LEVELS_PER_BASE_RANK);
  if (rankIndex === BASE_RANKS.length - 1) {
    return "Marshal";
  }

  const prestigeOrdinal = rankIndex - BASE_RANKS.length + 1;
  const atoms: string[] = [];
  let remainder = prestigeOrdinal;

  while (remainder > 0) {
    remainder -= 1;
    atoms.unshift(LEGACY_PRESTIGE_ATOMS[remainder % LEGACY_PRESTIGE_ATOMS.length]);
    remainder = Math.floor(remainder / LEGACY_PRESTIGE_ATOMS.length);
  }

  return `${atoms.join("-")} Marshal`;
}
