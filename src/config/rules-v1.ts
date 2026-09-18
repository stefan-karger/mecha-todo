export type ComboBonus = 0 | 2 | 4 | 6 | 8;

export const REWARD_RULES_V1 = Object.freeze({
  rulesVersion: 1 as const,
  todoBaseXp: 10 as const,
  dailyLinkBonus: 5 as const,
  comboMilestones: new Map<number, Exclude<ComboBonus, 0>>([
    [5, 2],
    [10, 4],
    [15, 6],
    [20, 8],
  ]) as ReadonlyMap<number, Exclude<ComboBonus, 0>>,
  curveAnchorLevel: 100 as const,
  todosAtLevel100: 500 as const,
});
