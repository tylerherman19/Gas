import type { PriceChange } from "@/lib/types";
import { TRACKED } from "@/lib/data";

const NAMES = new Map(TRACKED.map((t) => [t.station_id, t.label]));

export default function ChangeLog({ changes }: { changes: PriceChange[] }) {
  if (changes.length === 0) {
    return (
      <section className="rounded-xl border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
          Recent moves
        </h2>
        <p className="px-4 py-10 text-center text-sm text-muted">
          No price changes recorded yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
        Recent moves
      </h2>
      <ul className="divide-y divide-line">
        {changes.map((c) => {
          const delta =
            c.regular != null && c.previous_regular != null
              ? c.regular - c.previous_regular
              : null;

          return (
            <li
              key={`${c.station_id}-${c.observed_at}`}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className="w-32 shrink-0 truncate">
                {NAMES.get(c.station_id) ?? `#${c.station_id}`}
              </span>
              <span className="tnum w-20 shrink-0 font-medium">
                {c.regular != null ? `$${c.regular.toFixed(3)}` : "—"}
              </span>
              <span
                className="tnum w-20 shrink-0 text-xs"
                style={{
                  color:
                    delta == null
                      ? "var(--muted)"
                      : delta > 0
                        ? "var(--up)"
                        : "var(--down)",
                }}
              >
                {delta == null
                  ? "first"
                  : `${delta > 0 ? "+" : "−"}$${Math.abs(delta).toFixed(3)}`}
              </span>
              <time
                className="ml-auto shrink-0 text-xs text-muted"
                dateTime={c.observed_at}
              >
                {new Date(c.observed_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
