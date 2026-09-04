"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DailyPoint, Grade } from "@/lib/types";
import { TRACKED } from "@/lib/data";
import { dateKeyDaysAgo, formatDayKey } from "@/lib/dates";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 36500 },
] as const;

const COLOR: Record<number, string> = { 377: "var(--slp)", 648: "var(--grove)" };

/**
 * Lieflat Charts "barcode lollipop" (L3), bent around one question The Spread
 * only implies: how FAR apart were the two warehouses each day, and whose
 * side did the day land on?
 *
 * The encoding is carried over from the Lupi template rather than invented:
 * one hairline per calendar day — present even when nothing moved — a stem
 * from the zero line, a lollipop dot at the day's reading, the top-3 widest
 * gaps labeled, and month ticks along the baseline. The one structural
 * change the data forces is the zero line itself: a spread can be negative,
 * so the stem grows toward the cheaper warehouse instead of always downward.
 * Colour is the site's own palette (red = St Louis Park, blue = Maple
 * Grove), which a given day's dot inherits from that day's winner.
 */
export default function GapChart({ data }: { data: DailyPoint[] }) {
  const [days, setDays] = useState<number>(90);
  const [grade, setGrade] = useState<Grade>("regular");
  const [hover, setHover] = useState<number | null>(null);
  const [box, width] = useWidth();

  const compact = width > 0 && width < 520;

  const chart = useMemo(() => {
    if (width === 0) return null;

    const W = width;
    const H = compact ? 220 : 280;
    const PAD = {
      top: compact ? 18 : 24,
      right: compact ? 10 : 16,
      bottom: compact ? 30 : 34,
      left: compact ? 10 : 16,
    };

    const rows = data.filter((d) => d.day >= dateKeyDaysAgo(days));
    const allDays = [...new Set(rows.map((r) => r.day))].sort();
    if (!allDays.length) return null;

    const byStation = new Map<number, Map<string, number | null>>();
    for (const t of TRACKED) {
      byStation.set(
        t.station_id,
        new Map(
          rows.filter((r) => r.station_id === t.station_id).map((r) => [r.day, r[grade]]),
        ),
      );
    }
    const [a, b] = TRACKED.map((t) => t.station_id);

    type Tick = {
      day: string;
      /** slp minus grove, in dollars. Null when either side is unrecorded. */
      gap: number | null;
      winner: number | null;
    };
    const ticks: Tick[] = allDays.map((day) => {
      const va = byStation.get(a)?.get(day) ?? null;
      const vb = byStation.get(b)?.get(day) ?? null;
      if (va == null || vb == null) return { day, gap: null, winner: null };
      const gap = va - vb;
      return { day, gap, winner: Math.abs(gap) < 0.0005 ? null : gap < 0 ? a : b };
    });

    const known = ticks.filter((t) => t.gap != null).map((t) => Math.abs(t.gap!));
    if (!known.length) return null;

    // Floor the half-domain at 5¢ so a long tied stretch renders as the calm
    // it is instead of full-height drama.
    const half = Math.max(Math.max(...known), 0.05) * 1.18;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const zeroY = PAD.top + innerH / 2;
    const x = (i: number) =>
      PAD.left + (allDays.length === 1 ? innerW / 2 : (i / (allDays.length - 1)) * innerW);
    const y = (gap: number) => zeroY - (gap / half) * (innerH / 2);

    // Top-3 widest gaps, kept at least 6 days apart so labels never collide
    // (spacing rule straight from the template).
    const top3: number[] = [];
    for (const i of ticks
      .map((t, i) => ({ i, v: t.gap == null ? -1 : Math.abs(t.gap) }))
      .sort((m, n) => n.v - m.v)
      .map((m) => m.i)) {
      if (ticks[i].gap == null || Math.abs(ticks[i].gap!) < 0.0005) continue;
      if (top3.every((t) => Math.abs(t - i) >= 6)) top3.push(i);
      if (top3.length === 3) break;
    }

    // Month ticks along the baseline, at the first recorded day of each month.
    const months: { i: number; label: string }[] = [];
    let lastMonth = "";
    allDays.forEach((day, i) => {
      const month = day.slice(0, 7);
      if (month !== lastMonth) {
        months.push({
          i,
          label: formatDayKey(day).split(" ")[0].toUpperCase(),
        });
        lastMonth = month;
      }
    });

    return { W, H, PAD, allDays, ticks, x, y, zeroY, top3, months, half };
  }, [data, days, grade, width, compact]);

  const hoverTick = hover != null && chart ? chart.ticks[hover] : null;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
        <div>
          <h2 className="font-display text-2xl leading-none sm:text-3xl">The Gap</h2>
          <p className="pt-1.5 font-mono text-[10px] leading-snug text-ink-faint sm:text-[11px]">
            One tick per day — how far apart the warehouses posted, and whose side
            the day landed on
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

      <div ref={box} className="border border-rule-strong bg-card">
        {!chart ? (
          <p className="px-4 py-20 text-center font-mono text-xs text-ink-faint">
            {width === 0 ? "" : "Nothing recorded in this window yet."}
          </p>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${chart.W} ${chart.H}`}
              width={chart.W}
              height={chart.H}
              className="block h-auto w-full touch-pan-y"
              role="img"
              aria-label={`Daily ${grade} price gap between warehouses`}
              onMouseLeave={() => setHover(null)}
            >
              {/* The barcode field: one hairline per calendar day, whether or
                  not the day had a readable pair. */}
              {chart.allDays.map((day, i) => (
                <line
                  key={day}
                  x1={chart.x(i)}
                  x2={chart.x(i)}
                  y1={chart.PAD.top}
                  y2={chart.H - chart.PAD.bottom}
                  stroke={hover === i ? "var(--rule-strong)" : "var(--rule)"}
                  strokeWidth={1}
                />
              ))}

              {/* Even. */}
              <line
                x1={chart.PAD.left}
                x2={chart.W - chart.PAD.right}
                y1={chart.zeroY}
                y2={chart.zeroY}
                stroke="var(--ink)"
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.35}
              />

              {chart.ticks.map((t, i) => {
                if (t.gap == null) return null;
                const cx = chart.x(i);
                const cy = chart.y(t.gap);
                const tied = t.winner == null;
                const color = tied ? "var(--ink-faint)" : COLOR[t.winner!];
                const labeled = chart.top3.includes(i) && !tied;
                return (
                  <g key={t.day}>
                    <line
                      x1={cx}
                      x2={cx}
                      y1={chart.zeroY}
                      y2={cy}
                      stroke={color}
                      strokeWidth={hover === i ? 2 : 1.25}
                      opacity={tied ? 0.55 : 1}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={labeled ? 4.25 : hover === i ? 3.75 : 2.75}
                      fill={color}
                    />
                    {labeled && (
                      <text
                        x={cx}
                        y={cy + (t.gap! < 0 ? 14 : -8)}
                        textAnchor="middle"
                        className="tnum font-mono font-semibold"
                        fontSize={compact ? 8.5 : 9.5}
                        fill={color}
                      >
                        {Math.abs(t.gap! * 100).toFixed(1)}¢
                      </text>
                    )}
                  </g>
                );
              })}

              {chart.months.map((m) => (
                <text
                  key={m.label + m.i}
                  x={chart.x(m.i)}
                  y={chart.H - 10}
                  className="tracking-label fill-[var(--ink-faint)] font-mono"
                  fontSize={compact ? 8 : 9}
                >
                  {m.label}
                </text>
              ))}

              {/* Hit targets, same pointer pattern as The Spread. */}
              {chart.allDays.map((day, i) => {
                const step =
                  (chart.W - chart.PAD.left - chart.PAD.right) /
                  Math.max(chart.allDays.length - 1, 1);
                return (
                  <rect
                    key={day}
                    x={chart.x(i) - step / 2}
                    y={chart.PAD.top}
                    width={Math.max(step, 8)}
                    height={chart.H - chart.PAD.top - chart.PAD.bottom}
                    fill="transparent"
                    onPointerEnter={() => setHover(i)}
                    onPointerDown={() => setHover(i)}
                  />
                );
              })}
            </svg>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-3 py-2.5 sm:px-4 sm:py-3">
              {TRACKED.map((t) => {
                const wins = chart.ticks.filter((k) => k.winner === t.station_id).length;
                return (
                  <span
                    key={t.station_id}
                    className="flex items-center gap-1.5 font-mono text-[10px] sm:gap-2 sm:text-[11px]"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: COLOR[t.station_id] }}
                    />
                    <span className="text-ink-soft">{t.label}</span>
                    <span className="tnum font-semibold text-ink">
                      {wins} {wins === 1 ? "day" : "days"}
                    </span>
                  </span>
                );
              })}
              <span className="tnum ml-auto font-mono text-[10px] text-ink-faint sm:text-[11px]">
                {hoverTick
                  ? hoverTick.gap == null
                    ? `${fmtDay(hoverTick.day, true)} — unrecorded`
                    : hoverTick.winner == null
                      ? `${fmtDay(hoverTick.day, true)} — tied`
                      : `${fmtDay(hoverTick.day, true)} — ${
                          TRACKED.find((t) => t.station_id === hoverTick.winner)!.label
                        } by ${(Math.abs(hoverTick.gap) * 100).toFixed(1)}¢`
                  : `${chart.allDays.length} ${chart.allDays.length === 1 ? "day" : "days"}`}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* Toggle and useWidth mirror the ones in SpreadChart. Kept local so this
   chart can land without touching that file's internals. */
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
          className={`min-h-8 px-2.5 font-mono text-[11px] capitalize transition-colors ${
            i > 0 ? "border-l border-rule" : ""
          } ${value === o ? "bg-ink text-paper" : "text-ink-faint hover:text-ink"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

function fmtDay(day: string, long = false) {
  return formatDayKey(day, long);
}
