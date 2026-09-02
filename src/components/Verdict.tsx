import type { Station } from "@/lib/types";

/**
 * The whole point of the site, stated as a headline: which way to drive.
 */
export default function Verdict({
  winner,
  gap,
  checkedAt,
}: {
  winner: Station | null;
  gap: number | null;
  checkedAt: string | null;
}) {
  if (!winner) {
    return (
      <section className="border border-rule-strong bg-card px-6 py-10 text-center">
        <p className="font-display text-3xl text-ink-faint">Awaiting first reading</p>
      </section>
    );
  }

  const accent = winner.station_id === 377 ? "var(--slp)" : "var(--grove)";
  const tied = gap == null || gap < 0.001;
  const perFill = gap != null ? gap * 14 : 0;

  return (
    <section className="relative overflow-hidden border border-ink bg-card">
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />

      <div className="px-4 pt-7 pb-6 text-center sm:px-10 sm:pt-9 sm:pb-7">
        <p className="tracking-label font-mono text-[10px] text-ink-faint">
          {tied ? "Today it is a coin flip" : "Today, fill up at"}
        </p>

        <h2
          className="pt-3 font-display text-[clamp(2.1rem,10vw,5rem)] leading-[0.9] tracking-tight"
          style={{ color: tied ? "var(--ink)" : accent }}
        >
          {tied ? "Either One" : winner.name}
        </h2>

        {!tied && gap != null && (
          <p className="pt-4 font-display text-base italic leading-snug text-ink-soft sm:pt-5 sm:text-xl">
            cheaper by{" "}
            <span className="tnum not-italic font-sans font-semibold" style={{ color: accent }}>
              {(gap * 100).toFixed(1)}¢
            </span>{" "}
            a gallon — about{" "}
            <span className="tnum not-italic font-sans font-semibold" style={{ color: accent }}>
              ${perFill.toFixed(2)}
            </span>{" "}
            on a 14-gallon fill
          </p>
        )}

        {tied && (
          <p className="pt-4 font-display text-base italic leading-snug text-ink-soft sm:pt-5 sm:text-xl">
            both warehouses are posting the same price
          </p>
        )}
      </div>

      {checkedAt && (
        <div className="border-t border-rule px-4 py-2.5 text-center sm:px-10">
          <span className="tracking-label font-mono text-[10px] text-ink-faint">
            Last checked{" "}
            {new Date(checkedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}
    </section>
  );
}
