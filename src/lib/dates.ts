export const DISPLAY_TIME_ZONE = "America/Chicago";

export function dateKeyInTimeZone(date: Date, timeZone = DISPLAY_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateKeyDaysAgo(days: number): string {
  const [year, month, date] = dateKeyInTimeZone(new Date()).split("-").map(Number);
  return dateKeyInTimeZone(new Date(Date.UTC(year, month - 1, date - days, 12)));
}

export function formatDayKey(day: string, includeYear = false): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(new Date(Date.UTC(year, month - 1, date, 12)));
}
