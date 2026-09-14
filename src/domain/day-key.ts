export type LocalCalendarDate = Readonly<{
  year: number;
  month: number;
  day: number;
}>;

export type DayKey = string;

export function localCalendarDate(date: Date): LocalCalendarDate {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function toDayKey(date: LocalCalendarDate): DayKey {
  return `${date.year.toString().padStart(4, "0")}-${date.month
    .toString()
    .padStart(2, "0")}-${date.day.toString().padStart(2, "0")}`;
}

export function previousLocalDay(date: LocalCalendarDate): LocalCalendarDate {
  if (date.day > 1) {
    return { ...date, day: date.day - 1 };
  }

  if (date.month > 1) {
    const month = date.month - 1;
    return { year: date.year, month, day: daysInMonth(date.year, month) };
  }

  return { year: date.year - 1, month: 12, day: 31 };
}

export function previousDayKey(date: LocalCalendarDate): DayKey {
  return toDayKey(previousLocalDay(date));
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
