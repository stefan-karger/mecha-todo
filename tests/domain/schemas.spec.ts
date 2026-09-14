import { expect, test } from "@playwright/test";
import * as v from "valibot";
import {
  CompletionAwardRecordSchema,
  CoreMetaRecordSchema,
  DerivedStatsMetaRecordSchema,
  MetaRecordSchema,
  TodoRecordSchema,
  validateAuthoritativeRecords,
} from "../../src/persistence/schemas";

const activeTodo = {
  id: "todo-1",
  text: "Calibrate sensors",
  status: "active",
  creationOrder: 0,
  completionOrder: null,
  createdAt: 1,
  updatedAt: 1,
  completedAt: null,
} as const;

const completedTodo = {
  ...activeTodo,
  status: "completed",
  completionOrder: 0,
  completedAt: 2,
  updatedAt: 2,
} as const;

const award = {
  todoId: "todo-1",
  awardedAt: 2,
  dayKey: "2026-09-14",
  dailyOrdinal: 1,
  baseXp: 10,
  linkBonus: 0,
  comboBonus: 0,
  totalXp: 10,
  rulesVersion: 1,
} as const;

const core = {
  key: "core",
  createdAt: 1,
  rulesVersion: 1,
  nextCreationOrder: 1,
  nextCompletionOrder: 1,
} as const;

const derivedStats = {
  key: "derived-stats",
  lifetimeXp: 10,
  awardCount: 1,
} as const;

test("accepts valid todo status relationships and rejects invalid ones", () => {
  expect(v.safeParse(TodoRecordSchema, activeTodo).success).toBe(true);
  expect(v.safeParse(TodoRecordSchema, completedTodo).success).toBe(true);
  expect(
    v.safeParse(TodoRecordSchema, { ...activeTodo, completionOrder: 1, completedAt: 2 }).success,
  ).toBe(false);
  expect(
    v.safeParse(TodoRecordSchema, { ...completedTodo, completionOrder: null }).success,
  ).toBe(false);
  expect(v.safeParse(TodoRecordSchema, { ...activeTodo, text: "  not normalized" }).success).toBe(
    false,
  );
});

test("rejects unsafe ordering values and record revisions", () => {
  expect(
    v.safeParse(TodoRecordSchema, {
      ...activeTodo,
      creationOrder: Number.MAX_SAFE_INTEGER + 1,
    }).success,
  ).toBe(false);
  expect(v.safeParse(TodoRecordSchema, { ...activeTodo, revision: 1 }).success).toBe(false);
});

test("enforces immutable award fields and supported rules", () => {
  expect(v.safeParse(CompletionAwardRecordSchema, award).success).toBe(true);
  expect(v.safeParse(CompletionAwardRecordSchema, { ...award, baseXp: 11 }).success).toBe(false);
  expect(v.safeParse(CompletionAwardRecordSchema, { ...award, totalXp: 12 }).success).toBe(false);
  expect(v.safeParse(CompletionAwardRecordSchema, { ...award, rulesVersion: 2 }).success).toBe(false);
  expect(
    v.safeParse(CompletionAwardRecordSchema, {
      ...award,
      dailyOrdinal: 5,
      comboBonus: 2,
      totalXp: 12,
    }).success,
  ).toBe(true);
  expect(
    v.safeParse(CompletionAwardRecordSchema, {
      ...award,
      dayKey: "2025-02-29",
    }).success,
  ).toBe(false);
});

test("accepts only the named meta record shapes", () => {
  expect(v.safeParse(CoreMetaRecordSchema, core).success).toBe(true);
  expect(v.safeParse(DerivedStatsMetaRecordSchema, derivedStats).success).toBe(true);
  expect(v.safeParse(MetaRecordSchema, { ...core, rulesVersion: 2 }).success).toBe(false);
  expect(v.safeParse(MetaRecordSchema, { key: "snapshot", createdAt: 1 }).success).toBe(false);
});

test("validates cross-record completion and uniqueness invariants", () => {
  expect(
    validateAuthoritativeRecords({
      todos: [completedTodo],
      completionAwards: [award],
      meta: [core, derivedStats],
    }).ok,
  ).toBe(true);
  expect(
    validateAuthoritativeRecords({
      todos: [completedTodo],
      completionAwards: [],
      meta: [core],
    }),
  ).toEqual({ ok: false, category: "inconsistent-records" });
  expect(
    validateAuthoritativeRecords({
      todos: [activeTodo, { ...activeTodo, id: "todo-2" }],
      completionAwards: [],
      meta: [core],
    }),
  ).toEqual({ ok: false, category: "inconsistent-records" });
});
