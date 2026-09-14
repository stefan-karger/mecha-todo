export const TODO_TEXT_MAX_CODE_POINTS = 280;

export type ValidTodoText = {
  ok: true;
  value: string;
  codePointLength: number;
};

export type InvalidTodoText = {
  ok: false;
  reason: "empty" | "too-long";
  message: string;
  value: string;
  codePointLength: number;
};

export type TodoTextResult = ValidTodoText | InvalidTodoText;

export function normalizeTodoText(input: string): TodoTextResult {
  const value = input.replace(/\s+/gu, " ").trim();
  const codePointLength = Array.from(value).length;

  if (codePointLength === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "Enter a task.",
      value,
      codePointLength,
    };
  }

  if (codePointLength > TODO_TEXT_MAX_CODE_POINTS) {
    return {
      ok: false,
      reason: "too-long",
      message: `Task must be ${TODO_TEXT_MAX_CODE_POINTS} characters or fewer.`,
      value,
      codePointLength,
    };
  }

  return { ok: true, value, codePointLength };
}

export function createTodoId(): string {
  return crypto.randomUUID();
}
