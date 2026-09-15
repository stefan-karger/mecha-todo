import * as v from "valibot";
import { REWARD_RULES_V1 } from "../config/rules-v1";
import { normalizeTodoText } from "../domain/todo-text";
import type {
  CompletionAwardRecord,
  CoreMetaRecord,
  DerivedStatsMetaRecord,
  TodoRecord,
} from "./models";

const nonnegativeSafeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const positiveSafeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const normalizedTodoText = v.pipe(
  v.string(),
  v.check((input) => {
    const result = normalizeTodoText(input);
    return result.ok && result.value === input;
  }, "Todo text must already satisfy the normalized text contract."),
);
const dayKey = v.pipe(
  v.string(),
  v.regex(/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u),
  v.check(isValidGregorianDayKey, "Day key must be a valid Gregorian calendar date."),
);

export const TodoRecordSchema = v.pipe(
  v.strictObject({
    id: v.pipe(v.string(), v.minLength(1)),
    text: normalizedTodoText,
    status: v.union([v.literal("active"), v.literal("standby"), v.literal("completed")]),
    creationOrder: nonnegativeSafeInteger,
    completionOrder: v.nullable(nonnegativeSafeInteger),
    createdAt: nonnegativeSafeInteger,
    updatedAt: nonnegativeSafeInteger,
    completedAt: v.nullable(nonnegativeSafeInteger),
  }),
  v.check(
    (record) =>
      record.status === "completed"
        ? record.completionOrder !== null && record.completedAt !== null
        : record.completionOrder === null && record.completedAt === null,
    "Todo completion fields must match its status.",
  ),
  v.check((record) => record.updatedAt >= record.createdAt, "Todo update time precedes creation."),
);

export const CompletionAwardRecordSchema = v.pipe(
  v.strictObject({
    todoId: v.pipe(v.string(), v.minLength(1)),
    awardedAt: nonnegativeSafeInteger,
    dayKey,
    dailyOrdinal: positiveSafeInteger,
    baseXp: v.literal(10),
    linkBonus: v.union([v.literal(0), v.literal(5)]),
    comboBonus: v.union([
      v.literal(0),
      v.literal(2),
      v.literal(4),
      v.literal(6),
      v.literal(8),
    ]),
    totalXp: nonnegativeSafeInteger,
    rulesVersion: v.literal(REWARD_RULES_V1.rulesVersion),
  }),
  v.check(
    (award) => award.totalXp === award.baseXp + award.linkBonus + award.comboBonus,
    "Award total does not match its immutable XP fields.",
  ),
  v.check(
    (award) => award.linkBonus === 0 || award.dailyOrdinal === 1,
    "LINK is only valid for daily ordinal 1.",
  ),
  v.check(
    (award) =>
      award.comboBonus === (REWARD_RULES_V1.comboMilestones.get(award.dailyOrdinal) ?? 0),
    "COMBO does not match the rules V1 milestone.",
  ),
);

export const CoreMetaRecordSchema = v.strictObject({
  key: v.literal("core"),
  createdAt: nonnegativeSafeInteger,
  rulesVersion: v.literal(REWARD_RULES_V1.rulesVersion),
  nextCreationOrder: nonnegativeSafeInteger,
  nextCompletionOrder: nonnegativeSafeInteger,
});

export const DerivedStatsMetaRecordSchema = v.strictObject({
  key: v.literal("derived-stats"),
  lifetimeXp: nonnegativeSafeInteger,
  awardCount: nonnegativeSafeInteger,
});

export const MetaRecordSchema = v.variant("key", [
  CoreMetaRecordSchema,
  DerivedStatsMetaRecordSchema,
]);

export type AuthoritativeRecords = Readonly<{
  todos: readonly unknown[];
  completionAwards: readonly unknown[];
  meta: readonly unknown[];
}>;

export type ValidatedRecords = Readonly<{
  todos: TodoRecord[];
  completionAwards: CompletionAwardRecord[];
  core: CoreMetaRecord;
  derivedStats: DerivedStatsMetaRecord | null;
}>;

export type RecordsValidationResult =
  | Readonly<{ ok: true; value: ValidatedRecords }>
  | Readonly<{
      ok: false;
      category:
        | "invalid-todo"
        | "invalid-award"
        | "invalid-meta"
        | "unsupported-rules"
        | "unsafe-xp"
        | "inconsistent-records";
    }>;

export function validateAuthoritativeRecords(
  records: AuthoritativeRecords,
): RecordsValidationResult {
  const todos = parseAll(TodoRecordSchema, records.todos);
  if (!todos) {
    return { ok: false, category: "invalid-todo" };
  }

  if (hasUnsupportedAwardRules(records.completionAwards)) {
    return { ok: false, category: "unsupported-rules" };
  }

  const completionAwards = parseAll(CompletionAwardRecordSchema, records.completionAwards);
  if (!completionAwards) {
    return { ok: false, category: "invalid-award" };
  }

  if (hasUnsupportedCoreRules(records.meta)) {
    return { ok: false, category: "unsupported-rules" };
  }
  if (hasUnsafeStoredLifetimeXp(records.meta)) {
    return { ok: false, category: "unsafe-xp" };
  }

  const meta = parseAll(MetaRecordSchema, records.meta);
  if (!meta) {
    return { ok: false, category: "invalid-meta" };
  }

  const coreRecords = meta.filter((record): record is CoreMetaRecord => record.key === "core");
  const derivedStatsRecords = meta.filter(
    (record): record is DerivedStatsMetaRecord => record.key === "derived-stats",
  );
  if (coreRecords.length !== 1 || derivedStatsRecords.length > 1) {
    return { ok: false, category: "invalid-meta" };
  }

  if (!hasUniqueKeys(todos.map((todo) => todo.id))) {
    return { ok: false, category: "inconsistent-records" };
  }
  if (!hasUniqueKeys(todos.map((todo) => todo.creationOrder))) {
    return { ok: false, category: "inconsistent-records" };
  }
  if (!hasUniqueKeys(todos.flatMap((todo) => todo.completionOrder ?? []))) {
    return { ok: false, category: "inconsistent-records" };
  }
  if (!hasUniqueKeys(completionAwards.map((award) => award.todoId))) {
    return { ok: false, category: "inconsistent-records" };
  }
  if (!hasUniqueKeys(completionAwards.map((award) => `${award.dayKey}:${award.dailyOrdinal}`))) {
    return { ok: false, category: "inconsistent-records" };
  }

  const awardedTodoIds = new Set(completionAwards.map((award) => award.todoId));
  if (todos.some((todo) => todo.status === "completed" && !awardedTodoIds.has(todo.id))) {
    return { ok: false, category: "inconsistent-records" };
  }

  let lifetimeXp = 0;
  for (const award of completionAwards) {
    if (lifetimeXp > Number.MAX_SAFE_INTEGER - award.totalXp) {
      return { ok: false, category: "unsafe-xp" };
    }
    lifetimeXp += award.totalXp;
  }

  return {
    ok: true,
    value: {
      todos,
      completionAwards,
      core: coreRecords[0],
      derivedStats: derivedStatsRecords[0] ?? null,
    },
  };
}

function hasUnsupportedAwardRules(records: readonly unknown[]): boolean {
  return records.some(
    (record) =>
      isRecord(record) &&
      typeof record.todoId === "string" &&
      "rulesVersion" in record &&
      record.rulesVersion !== REWARD_RULES_V1.rulesVersion,
  );
}

function hasUnsupportedCoreRules(records: readonly unknown[]): boolean {
  return records.some(
    (record) =>
      isRecord(record) &&
      record.key === "core" &&
      "rulesVersion" in record &&
      record.rulesVersion !== REWARD_RULES_V1.rulesVersion,
  );
}

function hasUnsafeStoredLifetimeXp(records: readonly unknown[]): boolean {
  return records.some(
    (record) =>
      isRecord(record) &&
      record.key === "derived-stats" &&
      "lifetimeXp" in record &&
      (typeof record.lifetimeXp !== "number" ||
        !Number.isSafeInteger(record.lifetimeXp) ||
        record.lifetimeXp < 0),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAll<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  records: readonly unknown[],
): v.InferOutput<TSchema>[] | null {
  const output: v.InferOutput<TSchema>[] = [];

  for (const record of records) {
    const result = v.safeParse(schema, record);
    if (!result.success) {
      return null;
    }
    output.push(result.output);
  }

  return output;
}

function hasUniqueKeys(keys: readonly (string | number)[]): boolean {
  return new Set(keys).size === keys.length;
}

function isValidGregorianDayKey(value: string): boolean {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day <= (monthLengths[month - 1] ?? 0);
}
