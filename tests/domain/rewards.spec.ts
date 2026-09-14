import { expect, test } from "@playwright/test";
import {
  localCalendarDate,
  previousDayKey,
  type LocalCalendarDate,
} from "../../src/domain/day-key";
import {
  calculateCompletionAward,
  type CompletionAward,
} from "../../src/domain/rewards";

const today = { year: 2026, month: 9, day: 14 } as const;

function awardsForDay(count: number, localDate: LocalCalendarDate = today): CompletionAward[] {
  const awards: CompletionAward[] = [];

  for (let index = 0; index < count; index += 1) {
    awards.push(
      calculateCompletionAward({
        todoId: `todo-${index + 1}`,
        awardedAt: index,
        localDate,
        existingAwards: awards,
      }),
    );
  }

  return awards;
}

test.describe("calendar day keys", () => {
  test("uses injected local calendar parts", () => {
    const instant = new Date(2026, 8, 14, 23, 30);

    expect(localCalendarDate(instant)).toEqual({ year: 2026, month: 9, day: 14 });
  });

  test("finds yesterday across month, year, and leap-day boundaries", () => {
    expect(previousDayKey({ year: 2026, month: 5, day: 1 })).toBe("2026-04-30");
    expect(previousDayKey({ year: 2026, month: 1, day: 1 })).toBe("2025-12-31");
    expect(previousDayKey({ year: 2024, month: 3, day: 1 })).toBe("2024-02-29");
    expect(previousDayKey({ year: 2025, month: 3, day: 1 })).toBe("2025-02-28");
  });

  test("uses calendar arithmetic across daylight-saving boundaries", () => {
    expect(previousDayKey({ year: 2026, month: 3, day: 30 })).toBe("2026-03-29");
    expect(previousDayKey({ year: 2026, month: 10, day: 26 })).toBe("2026-10-25");
  });
});

test.describe("calculateCompletionAward", () => {
  test("applies the exact V1 milestone table", () => {
    const expected = new Map([
      [1, { comboBonus: 0, totalXp: 10 }],
      [5, { comboBonus: 2, totalXp: 12 }],
      [6, { comboBonus: 0, totalXp: 10 }],
      [10, { comboBonus: 4, totalXp: 14 }],
      [11, { comboBonus: 0, totalXp: 10 }],
      [15, { comboBonus: 6, totalXp: 16 }],
      [16, { comboBonus: 0, totalXp: 10 }],
      [20, { comboBonus: 8, totalXp: 18 }],
      [21, { comboBonus: 0, totalXp: 10 }],
    ]);
    const awards = awardsForDay(21);

    for (const [ordinal, result] of expected) {
      expect(awards[ordinal - 1]).toMatchObject({
        dailyOrdinal: ordinal,
        baseXp: 10,
        linkBonus: 0,
        comboBonus: result.comboBonus,
        totalXp: result.totalXp,
        rulesVersion: 1,
      });
    }
  });

  test("gives LINK only to today's first award when yesterday has an award", () => {
    const yesterday = { year: 2026, month: 9, day: 13 } as const;
    const existingAwards = awardsForDay(1, yesterday);
    const linked = calculateCompletionAward({
      todoId: "today-1",
      awardedAt: 10,
      localDate: today,
      existingAwards,
    });
    const second = calculateCompletionAward({
      todoId: "today-2",
      awardedAt: 11,
      localDate: today,
      existingAwards: [...existingAwards, linked],
    });

    expect(linked).toMatchObject({ dailyOrdinal: 1, linkBonus: 5, comboBonus: 0, totalXp: 15 });
    expect(second).toMatchObject({ dailyOrdinal: 2, linkBonus: 0, comboBonus: 0, totalXp: 10 });
  });

  test("gives LINK across month, year, leap-day, and daylight-saving boundaries", () => {
    const boundaries = [
      {
        name: "month",
        previous: { year: 2026, month: 4, day: 30 },
        current: { year: 2026, month: 5, day: 1 },
      },
      {
        name: "year",
        previous: { year: 2025, month: 12, day: 31 },
        current: { year: 2026, month: 1, day: 1 },
      },
      {
        name: "leap-day",
        previous: { year: 2024, month: 2, day: 29 },
        current: { year: 2024, month: 3, day: 1 },
      },
      {
        name: "daylight-saving start",
        previous: { year: 2026, month: 3, day: 29 },
        current: { year: 2026, month: 3, day: 30 },
      },
      {
        name: "daylight-saving end",
        previous: { year: 2026, month: 10, day: 25 },
        current: { year: 2026, month: 10, day: 26 },
      },
    ] as const;

    for (const boundary of boundaries) {
      const historicalAwards = awardsForDay(1, boundary.previous);
      const award = calculateCompletionAward({
        todoId: `after-${boundary.name}`,
        awardedAt: 10,
        localDate: boundary.current,
        existingAwards: historicalAwards,
      });

      expect(award.linkBonus, boundary.name).toBe(5);
    }
  });

  test("does not give LINK without an award on the preceding day", () => {
    const oldAwards = awardsForDay(1, { year: 2026, month: 9, day: 12 });

    expect(
      calculateCompletionAward({
        todoId: "today-1",
        awardedAt: 10,
        localDate: today,
        existingAwards: oldAwards,
      }),
    ).toMatchObject({ dailyOrdinal: 1, linkBonus: 0, totalXp: 10 });
  });

  test("never combines LINK and COMBO", () => {
    const existingAwards = awardsForDay(1, { year: 2026, month: 9, day: 13 });
    const awards = [...existingAwards];

    for (let index = 1; index <= 20; index += 1) {
      awards.push(
        calculateCompletionAward({
          todoId: `today-${index}`,
          awardedAt: index,
          localDate: today,
          existingAwards: awards,
        }),
      );
    }

    expect(awards.every((award) => award.linkBonus === 0 || award.comboBonus === 0)).toBe(true);
  });

  test("does not rewrite stored day keys after clock or timezone changes", () => {
    const historicalAwards = awardsForDay(1, { year: 2026, month: 9, day: 14 });
    const snapshot = structuredClone(historicalAwards);

    calculateCompletionAward({
      todoId: "shifted-clock",
      awardedAt: 20,
      localDate: { year: 2026, month: 9, day: 13 },
      existingAwards: historicalAwards,
    });

    expect(historicalAwards).toEqual(snapshot);
    expect(historicalAwards[0]?.dayKey).toBe("2026-09-14");
  });

  test("rejects a second award for the same todo", () => {
    const existingAwards = awardsForDay(1);

    expect(() =>
      calculateCompletionAward({
        todoId: "todo-1",
        awardedAt: 20,
        localDate: today,
        existingAwards,
      }),
    ).toThrow("A completion award already exists for this todo.");
  });
});
