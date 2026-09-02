"use client";

import { useMemo, useState } from "react";
import type { DailyPoint, Grade } from "@/lib/types";
import { TRACKED } from "@/lib/data";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 36500 },
] as const;

const COLOR: Record<number, string> = { 377: "var(--slp)", 648: "var(--grove)" };
const WASH: Record<number, string> = { 377: "var(--slp-wash)", 648: "var(--grove-wash)" };

const W = 760;
const H = 300;
const PAD = { top: 20, right: 16, bottom: 34, left: 52 };

type Pt = { x: number; y: number; v: number | null };

export default function SpreadChart({ data }: { data: DailyPoint[] }) {
  const [days, setDays] = useState<number>(30);
  const [grade, setGrade] = useState<Grade>("regular");
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = cutoff.toISOString().slice(0, 10);

    const rows = data.filter((d) => d.day >= cutoffKey);
    const allDays = [...new Set(rows.map((r) => r.day))].sort();
    if (!allDays.length) return null;

    const values = rows.map((r) => r[grade]).filter((v): v is number => v != null);
    if (!values.length) return null;

    const lo = Math.min(...values);
    const hi = Math.max(...values);
    // Floor the domain at ~8¢ so a flat stretch doesn't render as drama.
    const spread = Math.max(hi - lo, 0.08);
    const min = lo - spread * 0.22;
    const max = hi + spread * 0.22;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i: number) =>
      PAD.left + (allDays.length === 1 ? innerW / 2 : (i / (allDays.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

    const series = TRACKED.map((t) => {
      const byDay = new Map(
        rows.filter((r) => r.station_id === t.station_id).map((r) => [r.day, r[grade]]),
      );
      const points: Pt[] = allDays.map((day, i) => {
        const v = byDay.get(day) ?? null;
        return { x: x(i), y: v == null ? 0 : y(v), v };
      });
      return { ...t, points };
    });

    const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) / 3) * i);

    return {
      allDays,
      series,
      x,
      y,
      ticks,
      bands: buildBands(series[0]?.points ?? [], series[1]?.points ?? [], [
        series[0]?.station_id ?? 0,
        series[1]?.station_id ?? 0,
      ]),
    };
  }, [data, days, grade]);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
        <div>
          <h2 className="font-display text-3xl leading-none">The Spread</h2>
          <p className="pt-1.5 font-mono text-[11px] text-ink-faint">
            Shaded in favour of whichever warehouse is cheaper that day
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            options={["regular", "premium"]}
            value={grade}
            onChange={(v) => setGrade(v as Grade)}
          />
          <Toggle
            options={RANGES.map((r) => r.label)}
            value={RANGES.find((r) => r.days === days)!.label}
            onChange={(label) => setDays(RANGES.find((r) => r.label === label)!.days)}
          />
        </div>
      </div>

      <div className="border border-rule-strong bg-card">
        {!chart ? (
          <p className="px-4 py-24 text-center font-mono text-xs text-ink-faint">
            Nothing recorded in this window yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="h-[300px] w-full min-w-[560px]"
                role="img"
                aria-label={`${grade} price spread`}
                onMouseLeave={() => setHover(null)}
              >
                {chart.ticks.map((t, i) => (
                  <g key={i}>
                    <line
                      x1={PAD.left}
                      x2={W - PAD.right}
                      y1={chart.y(t)}
                      y2={chart.y(t)}
                      stroke="var(--rule)"
                      strokeWidth={1}
                    />
                    <text
                      x={PAD.left - 10}
                      y={chart.y(t) + 3.5}
                      textAnchor="end"
                      className="tnum fill-[var(--ink-faint)] font-mono text-[10px]"
                    >
                      ${t.toFixed(2)}
                    </text>
                  </g>
                ))}

                {chart.bands.map((b, i) => (
                  <path key={i} d={b.d} fill={WASH[b.winner]} />
                ))}

                {chart.series.map((s) => (
                  <g key={s.station_id}>
                    {pathSegments(s.points).map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        fill="none"
                        stroke={COLOR[s.station_id]}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ))}
                    {hover != null && s.points[hover]?.v != null && (
                      <circle
                        cx={s.points[hover].x}
                        cy={s.points[hover].y}
                        r={4.5}
                        fill="var(--card)"
                        stroke={COLOR[s.station_id]}
                        strokeWidth={2}
                      />
                    )}
                  </g>
                ))}

                {hover != null && (
                  <line
                    x1={chart.x(hover)}
                    x2={chart.x(hover)}
                    y1={PAD.top}
                    y2={H - PAD.bottom}
                    stroke="var(--ink)"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    opacity={0.4}
                  />
                )}

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

                <text x={PAD.left} y={H - 12} className="fill-[var(--ink-faint)] font-mono text-[10px]">
                  {fmtDay(chart.allDays[0])}
                </text>
                <text
                  x={W - PAD.right}
                  y={H - 12}
                  textAnchor="end"
                  className="fill-[var(--ink-faint)] font-mono text-[10px]"
                >
                  {fmtDay(chart.allDays[chart.allDays.length - 1])}
                </text>
              </svg>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-rule px-4 py-3">
              {chart.series.map((s) => {
                const shown =
                  hover != null
                    ? s.points[hover]?.v
                    : [...s.points].reverse().find((p) => p.v != null)?.v;
                return (
                  <span key={s.station_id} className="flex items-center gap-2 font-mono text-[11px]">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: COLOR[s.station_id] }}
                    />
                    <span className="text-ink-soft">{s.label}</span>
                    <span className="tnum font-semibold text-ink">
                      {shown != null ? `$${shown.toFixed(3)}` : "—"}
                    </span>
                  </span>
                );
              })}
              <span className="tnum ml-auto font-mono text-[11px] text-ink-faint">
                {hover != null ? fmtDay(chart.allDays[hover], true) : `${chart.allDays.length} days shown`}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex border border-rule-strong bg-card">
      {options.map((o, i) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-2.5 py-1 font-mono text-[11px] capitalize transition-colors ${
            i > 0 ? "border-l border-rule" : ""
          } ${value === o ? "bg-ink text-paper" : "text-ink-faint hover:text-ink"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Break a line at nulls so gaps don't draw a fake straight run. */
function pathSegments(points: Pt[]): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (const p of points) {
    if (p.v == null) {
      if (cur.length) out.push(cur.join(" "));
      cur = [];
      continue;
    }
    cur.push(`${cur.length ? "L" : "M"}${p.x},${p.y}`);
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

/**
 * The area between the two lines, split at every crossing so each band can be
 * tinted for whichever station is cheaper across that stretch. Adjacent bands
 * of the same colour render as one continuous shape.
 */
function buildBands(a: Pt[], b: Pt[], ids: [number, number]) {
  const bands: { d: string; winner: number }[] = [];
  const cheaper = (va: number, vb: number) => (va < vb ? ids[0] : ids[1]);

  for (let i = 0; i < Math.min(a.length, b.length) - 1; i++) {
    const a0 = a[i], a1 = a[i + 1], b0 = b[i], b1 = b[i + 1];
    if (a0.v == null || a1.v == null || b0.v == null || b1.v == null) continue;

    const s0 = a0.v - b0.v;
    const s1 = a1.v - b1.v;

    if (s0 === 0 && s1 === 0) continue;

    // No crossing: one quad spanning the interval.
    if (s0 === 0 || s1 === 0 || Math.sign(s0) === Math.sign(s1)) {
      const winner = cheaper(s0 !== 0 ? a0.v : a1.v, s0 !== 0 ? b0.v : b1.v);
      bands.push({
        d: `M${a0.x},${a0.y} L${a1.x},${a1.y} L${b1.x},${b1.y} L${b0.x},${b0.y} Z`,
        winner,
      });
      continue;
    }

    // Crossing: split into two triangles meeting where the lines intersect.
    const t = s0 / (s0 - s1);
    const cx = a0.x + (a1.x - a0.x) * t;
    const cy = a0.y + (a1.y - a0.y) * t;

    bands.push({
      d: `M${a0.x},${a0.y} L${cx},${cy} L${b0.x},${b0.y} Z`,
      winner: cheaper(a0.v, b0.v),
    });
    bands.push({
      d: `M${cx},${cy} L${a1.x},${a1.y} L${b1.x},${b1.y} Z`,
      winner: cheaper(a1.v, b1.v),
    });
  }

  return bands;
}

function fmtDay(day: string, long = false) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(long ? { year: "numeric" } : {}),
  });
}
