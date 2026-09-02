import type { PriceChange } from "@/lib/types";
import { TRACKED } from "@/lib/data";
import { DISPLAY_TIME_ZONE } from "@/lib/dates";

const NAMES = new Map(TRACKED.map((t) => [t.station_id, t.label]));
const COLOR: Record<number, string> = { 377: "var(--slp)", 648: "var(--grove)" };

export default function Ledger({ changes }: { changes: PriceChange[] }) {
  return (
    <section>
      <div className="pb-3">
        <h2 className="font-display text-2xl leading-none sm:text-3xl">The Ledger</h2>
        <p className="pt-1.5 font-mono text-[11px] text-ink-faint">
          Every recorded move, newest first
        </p>
      </div>

      <div className="border border-rule-strong bg-card">
        {changes.length === 0 ? (
          <p className="px-4 py-16 text-center font-mono text-xs text-ink-faint">
            No moves recorded yet.
          </p>
        ) : (
          <ul>
            {changes.map((c, i) => {
              const delta =
                c.regular != null && c.previous_regular != null
                  ? c.regular - c.previous_regular
                  : null;

              return (
                <li
                  key={`${c.station_id}-${c.observed_at}`}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 ${
                    i > 0 ? "border-t border-rule" : ""
                  }`}
                >
                  <span
                    className="h-6 w-1 shrink-0"
                    style={{ background: COLOR[c.station_id] ?? "var(--rule-strong)" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {NAMES.get(c.station_id) ?? `No. ${c.station_id}`}
                  </span>
                  <span className="tnum shrink-0 font-mono text-[13px] font-semibold sm:text-sm">
                    {c.regular != null ? `$${c.regular.toFixed(3)}` : "—"}
                  </span>
                  <span
                    className="tnum w-20 shrink-0 text-right font-mono text-[11px]"
                    style={{
                      color:
                        delta == null
                          ? "var(--ink-faint)"
                          : delta > 0
                            ? "var(--up)"
                            : "var(--down)",
                    }}
                  >
                    {delta == null
                      ? "first"
                      : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta * 100).toFixed(1)}¢`}
                  </span>
                  {/* Drops to its own line on narrow screens rather than
                      pushing the row into overflow. */}
                  <time
                    className="w-full shrink-0 pl-4 font-mono text-[11px] text-ink-faint sm:w-40 sm:pl-0 sm:text-right"
                    dateTime={c.observed_at}
                  >
                    {new Date(c.observed_at).toLocaleString("en-US", {
                      timeZone: DISPLAY_TIME_ZONE,
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
