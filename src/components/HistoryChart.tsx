"use client";

import { useMemo, useState } from "react";
import type { DailyPoint, Grade } from "@/lib/types";
import { TRACKED } from "@/lib/data";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 3650 },
] as const;

const SERIES_COLOR: Record<number, string> = {
  377: "var(--accent)",
  648: "#3b6ea5",
};

const W = 720;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 26, left: 44 };

export default function HistoryChart({ data }: { data: DailyPoint[] }) {
  const [days, setDays] = useState<number>(30);
  const [grade, setGrade] = useState<Grade>("regular");
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = cutoff.toISOString().slice(0, 10);

    const rows = data.filter((d) => d.day >= cutoffKey);
    const allDays = [...new Set(rows.map((r) => r.day))].sort();
    if (allDays.length === 0) return null;

    const series = TRACKED.map((t) => {
      const byDay = new Map(
        rows.filter((r) => r.station_id === t.station_id).map((r) => [r.day, r[grade]]),
      );
      return {
        station_id: t.station_id,
        label: t.label,
        points: allDays.map((day) => ({ day, value: byDay.get(day) ?? null })),
      };
    });

    const values = series.flatMap((s) =>
      s.points.map((p) => p.value).filter((v): v is number => v != null),
    );
    if (values.length === 0) return null;

    // Pad the domain so lines never touch the frame, and keep a floor of
    // ~10 cents so a flat week doesn't render as dramatic noise.
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const spread = Math.max(hi - lo, 0.1);
    const min = lo - spread * 0.15;
    const max = hi + spread * 0.15;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i: number) =>
      PAD.left + (allDays.length === 1 ? innerW / 2 : (i / (allDays.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

    const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) / 3) * i);

    return { allDays, series, x, y, ticks, min, max };
  }, [data, days, grade]);

  const hasData = chart !== null;

  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Price history</h2>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-line p-0.5">
          {(["regular", "premium"] as Grade[]).map((g) => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`rounded-md px-2.5 py-1 text-xs capitalize transition-colors ${
                grade === g ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setDays(r.days)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                days === r.days ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="px-4 py-16 text-center text-sm text-muted">
          No readings in this range yet.
        </p>
      ) : (
        <div className="overflow-x-auto px-2 py-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[260px] w-full min-w-[520px]"
            role="img"
            aria-label={`${grade} price history`}
            onMouseLeave={() => setHover(null)}
          >
            {chart.ticks.map((t, i) => (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={chart.y(t)}
                  y2={chart.y(t)}
                  stroke="var(--line)"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={chart.y(t) + 3.5}
                  textAnchor="end"
                  className="tnum fill-[var(--muted)] text-[10px]"
                >
                  ${t.toFixed(2)}
                </text>
              </g>
            ))}

            {chart.series.map((s) => {
              // Break the path at gaps so missing days don't draw a fake
              // straight line across the chart.
              const segments: string[] = [];
              let current: string[] = [];
              s.points.forEach((p, i) => {
                if (p.value == null) {
                  if (current.length) segments.push(current.join(" "));
                  current = [];
                  return;
                }
                current.push(`${current.length ? "L" : "M"}${chart.x(i)},${chart.y(p.value)}`);
              });
              if (current.length) segments.push(current.join(" "));

              return (
                <g key={s.station_id}>
                  {segments.map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill="none"
                      stroke={SERIES_COLOR[s.station_id]}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))}
                  {hover != null && s.points[hover]?.value != null && (
                    <circle
                      cx={chart.x(hover)}
                      cy={chart.y(s.points[hover].value!)}
                      r={4}
                      fill="var(--surface)"
                      stroke={SERIES_COLOR[s.station_id]}
                      strokeWidth={2}
                    />
                  )}
                </g>
              );
            })}

            {hover != null && (
              <line
                x1={chart.x(hover)}
                x2={chart.x(hover)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {/* Invisible hit targets, one per day. */}
            {chart.allDays.map((day, i) => {
              const step = (W - PAD.left - PAD.right) / Math.max(chart.allDays.length - 1, 1);
              return (
                <rect
                  key={day}
                  x={chart.x(i) - step / 2}
                  y={PAD.top}
                  width={step}
                  height={H - PAD.top - PAD.bottom}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              );
            })}

            <text
              x={PAD.left}
              y={H - 8}
              className="fill-[var(--muted)] text-[10px]"
            >
              {formatDay(chart.allDays[0])}
            </text>
            <text
              x={W - PAD.right}
              y={H - 8}
              textAnchor="end"
              className="fill-[var(--muted)] text-[10px]"
            >
              {formatDay(chart.allDays[chart.allDays.length - 1])}
            </text>
          </svg>

          <div className="flex flex-wrap items-center gap-4 px-2 pb-1 pt-2 text-xs">
            {chart.series.map((s) => {
              const shown =
                hover != null ? s.points[hover]?.value : s.points[s.points.length - 1]?.value;
              return (
                <span key={s.station_id} className="flex items-center gap-1.5 text-muted">
                  <span
                    className="h-0.5 w-4 rounded-full"
                    style={{ background: SERIES_COLOR[s.station_id] }}
                  />
                  {s.label}
                  <span className="tnum font-medium text-foreground">
                    {shown != null ? `$${shown.toFixed(3)}` : "—"}
                  </span>
                </span>
              );
            })}
            {hover != null && (
              <span className="ml-auto tnum text-muted">
                {formatDay(chart.allDays[hover], true)}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function formatDay(day: string, long = false) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(long ? { year: "numeric" } : {}),
  });
}
