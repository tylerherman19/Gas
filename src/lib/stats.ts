import type { DailyPoint, Grade } from "./types";

export type StationStats = {
  station_id: number;
  current: number | null;
  /** Change over the trailing 7 days, in dollars. Null until 7 days of data. */
  change7d: number | null;
  /** Last 8 daily values (7 days of change), oldest first, for the sparkline. */
  spark: (number | null)[];
  low30: number | null;
  high30: number | null;
  avg30: number | null;
};

function seriesFor(daily: DailyPoint[], stationId: number, grade: Grade) {
  return daily
    .filter((d) => d.station_id === stationId)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ day: d.day, value: d[grade] }));
}

export function statsFor(
  daily: DailyPoint[],
  stationId: number,
  grade: Grade = "regular",
): StationStats {
  const series = seriesFor(daily, stationId, grade);
  const values = series.map((s) => s.value);
  const known = values.filter((v): v is number => v != null);

  const current = known.length ? known[known.length - 1] : null;

  // Compare against the reading 7 calendar days back, not 7 rows back —
  // the daily view is forward-filled, so those are the same thing here,
  // but only while the series has no leading gap.
  const sevenBack = values.length >= 8 ? values[values.length - 8] : null;
  const change7d = current != null && sevenBack != null ? current - sevenBack : null;

  const last30 = known.slice(-30);

  return {
    station_id: stationId,
    current,
    change7d,
    spark: values.slice(-8),
    low30: last30.length ? Math.min(...last30) : null,
    high30: last30.length ? Math.max(...last30) : null,
    avg30: last30.length ? last30.reduce((a, b) => a + b, 0) / last30.length : null,
  };
}

/**
 * How many of the last `days` days each station was the cheaper of the two.
 * Ties count for neither.
 */
export function cheaperDayCount(
  daily: DailyPoint[],
  a: number,
  b: number,
  days = 30,
): { [id: number]: number; ties: number } {
  const byDay = new Map<string, { [id: number]: number | null }>();

  for (const row of daily) {
    if (row.station_id !== a && row.station_id !== b) continue;
    const entry = byDay.get(row.day) ?? {};
    entry[row.station_id] = row.regular;
    byDay.set(row.day, entry);
  }

  const recent = [...byDay.entries()].sort((x, y) => x[0].localeCompare(y[0])).slice(-days);

  const out = { [a]: 0, [b]: 0, ties: 0 };
  for (const [, entry] of recent) {
    const va = entry[a];
    const vb = entry[b];
    if (va == null || vb == null) continue;
    if (va < vb) out[a] += 1;
    else if (vb < va) out[b] += 1;
    else out.ties += 1;
  }
  return out;
}
