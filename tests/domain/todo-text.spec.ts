import { expect, test } from "@playwright/test";
import {
  createTodoId,
  normalizeTodoText,
  TODO_TEXT_MAX_CODE_POINTS,
} from "../../src/domain/todo-text";

test.describe("normalizeTodoText", () => {
  test("collapses multiline paste and unusual JavaScript whitespace", () => {
    const result = normalizeTodoText("\uFEFF  Repair\n\r\tleft\u00A0\u2003arm  \uFEFF");

    expect(result).toEqual({
      ok: true,
      value: "Repair left arm",
      codePointLength: 15,
    });
  });

  test("preserves casing, non-whitespace characters, and Unicode composition", () => {
    const decomposed = "Cafe\u0301";
    const result = normalizeTodoText(`  ${decomposed} vs CAFÉ  `);

    expect(result).toEqual({
      ok: true,
      value: `${decomposed} vs CAFÉ`,
      codePointLength: 13,
    });
    expect(result.ok && result.value.normalize("NFC")).not.toBe(result.ok && result.value);
  });

  test("returns a specific empty result at the zero boundary", () => {
    expect(normalizeTodoText(" \n\t\u00A0 ")).toEqual({
      ok: false,
      reason: "empty",
      message: "Enter a task.",
      value: "",
      codePointLength: 0,
    });
  });

  test("accepts one code point", () => {
    expect(normalizeTodoText("🤖")).toEqual({
      ok: true,
      value: "🤖",
      codePointLength: 1,
    });
  });

  test("accepts exactly 280 code points", () => {
    const value = "🤖".repeat(TODO_TEXT_MAX_CODE_POINTS);

    expect(normalizeTodoText(value)).toEqual({
      ok: true,
      value,
      codePointLength: TODO_TEXT_MAX_CODE_POINTS,
    });
  });

  test("rejects 281 code points without truncating", () => {
    const value = "🤖".repeat(TODO_TEXT_MAX_CODE_POINTS + 1);

    expect(normalizeTodoText(value)).toEqual({
      ok: false,
      reason: "too-long",
      message: "Task must be 280 characters or fewer.",
      value,
      codePointLength: TODO_TEXT_MAX_CODE_POINTS + 1,
    });
  });

  test("accepts duplicate normalized text", () => {
    const first = normalizeTodoText("Calibrate sensors");
    const duplicate = normalizeTodoText("  Calibrate\t sensors  ");

    expect(first).toEqual(duplicate);
    expect(first.ok).toBe(true);
  });
});

test("createTodoId returns unique opaque UUIDs", () => {
  const first = createTodoId();
  const second = createTodoId();

  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  expect(second).not.toBe(first);
});
