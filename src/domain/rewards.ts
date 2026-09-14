import { REWARD_RULES_V1, type ComboBonus } from "../config/rules-v1";
import { previousDayKey, toDayKey, type DayKey, type LocalCalendarDate } from "./day-key";

export type CompletionAward = Readonly<{
  todoId: string;
  awardedAt: number;
  dayKey: DayKey;
  dailyOrdinal: number;
  baseXp: 10;
  linkBonus: 0 | 5;
  comboBonus: ComboBonus;
  totalXp: number;
  rulesVersion: 1;
}>;

export type CompletionAwardInput = Readonly<{
  todoId: string;
  awardedAt: number;
  localDate: LocalCalendarDate;
  existingAwards: readonly CompletionAward[];
}>;

export function calculateCompletionAward({
  todoId,
  awardedAt,
  localDate,
  existingAwards,
}: CompletionAwardInput): CompletionAward {
  if (existingAwards.some((award) => award.todoId === todoId)) {
    throw new Error("A completion award already exists for this todo.");
  }

  const dayKey = toDayKey(localDate);
  const dailyOrdinal =
    existingAwards.reduce(
      (highest, award) =>
        award.dayKey === dayKey ? Math.max(highest, award.dailyOrdinal) : highest,
      0,
    ) + 1;
  const yesterdayHasAward = existingAwards.some(
    (award) => award.dayKey === previousDayKey(localDate),
  );
  const linkBonus = dailyOrdinal === 1 && yesterdayHasAward ? 5 : 0;
  const comboBonus = REWARD_RULES_V1.comboMilestones.get(dailyOrdinal) ?? 0;

  return Object.freeze({
    todoId,
    awardedAt,
    dayKey,
    dailyOrdinal,
    baseXp: REWARD_RULES_V1.todoBaseXp,
    linkBonus,
    comboBonus,
    totalXp: REWARD_RULES_V1.todoBaseXp + linkBonus + comboBonus,
    rulesVersion: REWARD_RULES_V1.rulesVersion,
  });
}
