import CountUp from "@/components/CountUp";
import type { Station } from "@/lib/types";
import type { StationStats } from "@/lib/stats";

export default function StationPanel({
  station,
  stats,
  accent,
  isCheapest,
  daysCheaper,
  daysCounted,
}: {
  station: Station;
  stats: StationStats;
  accent: "slp" | "grove";
  isCheapest: boolean;
  daysCheaper: number;
  daysCounted: number;
}) {
  const color = accent === "slp" ? "var(--slp)" : "var(--grove)";
  const share = daysCounted > 0 ? daysCheaper / daysCounted : 0;

  return (
    <article
      className="relative h-full border bg-card p-5 sm:p-6"
      style={{ borderColor: isCheapest ? color : "var(--rule-strong)" }}
    >
      {/* Colour bar keys this panel to its line in the chart. */}
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />

      <header className="flex items-baseline justify-between gap-3 pt-2">
        <h3 className="font-display text-2xl leading-none">{station.name}</h3>
        <span className="tnum font-mono text-[11px] text-ink-faint">
          No. {station.station_id}
        </span>
      </header>
      <p className="pt-1 font-mono text-[11px] text-ink-faint">
        {station.city}, {station.state}
      </p>

      <div className="pt-6">
        <p className="tnum font-display text-[clamp(2.75rem,11vw,3.5rem)] leading-[0.82]" style={{ color }}>
          {station.regular != null ? (
            <CountUp value={station.regular} format="price" delay={220} />
          ) : (
            "—.———"
          )}
        </p>
        <p className="tracking-label pt-2 font-mono text-[10px] text-ink-faint">
          Regular
        </p>
      </div>

      {/* The seven-day move, given its own band — it is the question most
          people are actually asking. */}
      <div className="mt-5 flex items-center justify-between gap-4 border-y border-rule py-3">
        <div>
          <p className="tracking-label font-mono text-[10px] text-ink-faint">
            7-day change
          </p>
          {stats.change7d == null ? (
            <p className="pt-1.5 font-mono text-lg text-ink-faint">
              not yet — <span className="text-[11px]">needs 7 days</span>
            </p>
          ) : (
            <p
              className="tnum pt-1 font-display text-3xl leading-none"
              style={{ color: changeColor(stats.change7d) }}
            >
              {stats.change7d > 0 ? "▲" : stats.change7d < 0 ? "▼" : "◆"}{" "}
              <CountUp
                value={Math.abs(stats.change7d * 100)}
                format="cents"
                delay={320}
              />
            </p>
          )}
        </div>
        <Sparkline values={stats.spark} color={color} />
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="tracking-label font-mono text-[10px] text-ink-faint">
          Premium
        </span>
        <span className="tnum font-mono text-sm font-semibold">
          {station.premium != null ? (
            <CountUp value={station.premium} format="price" delay={380} />
          ) : (
            "—"
          )}
        </span>
      </div>

      <div className="mt-5 border-t border-rule pt-3">
        <div className="flex items-baseline justify-between">
          <span className="tracking-label font-mono text-[10px] text-ink-faint">
            Cheaper on
          </span>
          <span className="tnum font-mono text-[11px]">
            {daysCounted > 0 ? `${daysCheaper} of ${daysCounted} days` : "—"}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full bg-paper-deep">
          <div
            className="grow-bar h-full"
            style={
              {
                width: `${Math.round(share * 100)}%`,
                background: color,
                "--m-delay": "450ms",
              } as React.CSSProperties
            }
          />
        </div>
      </div>
    </article>
  );
}

function changeColor(change: number) {
  if (change > 0) return "var(--up)";
  if (change < 0) return "var(--down)";
  return "var(--ink-soft)";
}

/** Eight days of readings, drawn small. Silent until there are two to join. */
function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const known = values.filter((v): v is number => v != null);
  if (known.length < 2) return null;

  const w = 104;
  const h = 40;
  const min = Math.min(...known);
  const max = Math.max(...known);
  const range = Math.max(max - min, 0.02);

  // Inset by the dot radius so the trailing marker isn't clipped by the viewBox.
  const inset = 3;
  const pts = values
    .map((v, i) => {
      if (v == null) return null;
      const x = inset + (i / (values.length - 1)) * (w - inset * 2);
      const y = inset + (h - ((v - min) / range) * h) * ((h - inset * 2) / h);
      return `${x},${y}`;
    })
    .filter(Boolean) as string[];

  const last = pts[pts.length - 1].split(",").map(Number);

  const first = pts[0].split(",").map(Number);

  return (
    <svg
      width={w}
      height={h + 8}
      viewBox={`0 0 ${w} ${h + 8}`}
      aria-hidden
      className="shrink-0 self-end"
    >
      <path
        d={`M${first[0]},${h + 8} L${pts.join(" L")} L${last[0]},${h + 8} Z`}
        fill={color}
        opacity={0.08}
        className="spark-fill"
        style={{ "--m-delay": "300ms" } as React.CSSProperties}
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
        pathLength={1}
        className="draw-line"
        style={{ "--m-delay": "300ms" } as React.CSSProperties}
      />
      <circle cx={last[0]} cy={last[1]} r={2.75} fill={color} className="band" />
    </svg>
  );
}
