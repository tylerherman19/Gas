import GapChart from "@/components/GapChart";
import Ledger from "@/components/Ledger";
import SpreadChart from "@/components/SpreadChart";
import StationPanel from "@/components/StationPanel";
import Verdict from "@/components/Verdict";
import { getDaily, getRecentChanges, getStations, TRACKED } from "@/lib/data";
import { cheaperDayCount, statsFor } from "@/lib/stats";
import { isConfigured } from "@/lib/supabase";

// Prices move on Costco's schedule, not ours.
export const revalidate = 600;

export default async function Page() {
  if (!isConfigured) return <SetupNotice />;

  const [stations, daily, changes] = await Promise.all([
    getStations(),
    getDaily(36500),
    getRecentChanges(12),
  ]);

  if (stations.length === 0) return <EmptyNotice />;

  const priced = stations.filter((s) => s.regular != null);
  const winner = priced.length
    ? priced.reduce((a, b) => (a.regular! <= b.regular! ? a : b))
    : null;
  const gap =
    priced.length === 2 ? Math.abs(priced[0].regular! - priced[1].regular!) : null;

  const [a, b] = TRACKED.map((t) => t.station_id);
  const cheaperDays = cheaperDayCount(daily, a, b, 30);
  const daysCounted = cheaperDays[a] + cheaperDays[b] + cheaperDays.ties;

  const statsById = new Map(stations.map((s) => [s.station_id, statsFor(daily, s.station_id)]));

  const combined = [...statsById.values()].filter((s) => s.avg30 != null);
  const avg30 = combined.length
    ? combined.reduce((sum, s) => sum + s.avg30!, 0) / combined.length
    : null;
  const low30 = combined.length ? Math.min(...combined.map((s) => s.low30!)) : null;
  const high30 = combined.length ? Math.max(...combined.map((s) => s.high30!)) : null;
  const daysTracked = new Set(daily.map((d) => d.day)).size;

  return (
    <div className="space-y-9 sm:space-y-12">
      <Verdict winner={winner} gap={gap} checkedAt={winner?.last_checked_at ?? null} />

      <section className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {stations.map((s) => (
          <StationPanel
            key={s.station_id}
            station={s}
            stats={statsById.get(s.station_id)!}
            accent={s.station_id === 377 ? "slp" : "grove"}
            isCheapest={winner?.station_id === s.station_id && (gap ?? 0) >= 0.001}
            daysCheaper={cheaperDays[s.station_id] ?? 0}
            daysCounted={daysCounted}
          />
        ))}
      </section>

      <div className="perforated" />

      <SpreadChart data={daily} />

      <GapChart data={daily} />

      <section className="grid grid-cols-2 gap-px border border-rule-strong bg-rule sm:grid-cols-4">
        <Figure label="30-day low" value={low30 != null ? `$${low30.toFixed(3)}` : "—"} />
        <Figure label="30-day high" value={high30 != null ? `$${high30.toFixed(3)}` : "—"} />
        <Figure label="30-day average" value={avg30 != null ? `$${avg30.toFixed(3)}` : "—"} />
        <Figure label="Days on record" value={String(daysTracked)} />
      </section>

      <div className="perforated" />

      <Ledger changes={changes} />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-3 py-3.5 sm:px-4 sm:py-4">
      <p className="tracking-label font-mono text-[10px] text-ink-faint">{label}</p>
      <p className="tnum pt-1.5 font-display text-xl leading-none sm:text-2xl">{value}</p>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="border border-rule-strong bg-card p-8">
      <h2 className="font-display text-3xl">Not configured yet</h2>
      <p className="max-w-lg pt-3 text-sm leading-relaxed text-ink-soft">
        Set <Code>NEXT_PUBLIC_SUPABASE_URL</Code> and{" "}
        <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code>, run the migration in{" "}
        <Code>supabase/migrations/</Code>, then run <Code>npm run scrape</Code>. The
        README has the full sequence.
      </p>
    </div>
  );
}

function EmptyNotice() {
  return (
    <div className="border border-rule-strong bg-card p-8">
      <h2 className="font-display text-3xl">No warehouses on file</h2>
      <p className="max-w-lg pt-3 text-sm leading-relaxed text-ink-soft">
        Run the migration to seed No. 377 and No. 648, then{" "}
        <Code>npm run scrape</Code>.
      </p>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-paper-deep px-1.5 py-0.5 font-mono text-xs">{children}</code>
  );
}
