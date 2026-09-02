import ChangeLog from "@/components/ChangeLog";
import HistoryChart from "@/components/HistoryChart";
import StationCard from "@/components/StationCard";
import { getDaily, getRecentChanges, getStations } from "@/lib/data";
import { isConfigured } from "@/lib/supabase";

// Prices move on Costco's schedule, not ours; revalidate every 10 minutes.
export const revalidate = 600;

export default async function Page() {
  const [stations, daily, changes] = await Promise.all([
    getStations(),
    getDaily(3650),
    getRecentChanges(15),
  ]);

  if (!isConfigured) return <SetupNotice />;

  const priced = stations.filter((s) => s.regular != null);
  const cheapest = priced.length
    ? priced.reduce((a, b) => (a.regular! <= b.regular! ? a : b))
    : null;
  const gap =
    priced.length === 2 ? Math.abs(priced[0].regular! - priced[1].regular!) : null;

  // Previous reading per station, for the ▲/▼ delta on each card.
  const previous = new Map<number, number | null>();
  for (const c of [...changes].reverse()) {
    previous.set(c.station_id, c.previous_regular);
  }

  const stats = summarize(daily);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          Costco Gas: St Louis Park vs Maple Grove
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Two Twin Cities warehouses, thirteen miles apart, rarely priced the
          same. This tracks what each one charges and how it has moved.
        </p>
      </section>

      {cheapest && (
        <section className="rounded-xl border border-line bg-accent-soft px-5 py-4">
          <p className="text-sm">
            <span className="font-semibold text-accent">{cheapest.name}</span> is
            cheaper right now
            {gap != null && gap > 0 ? (
              <>
                {" "}
                by{" "}
                <span className="tnum font-semibold text-accent">
                  {(gap * 100).toFixed(1)}¢
                </span>
                /gal — about{" "}
                <span className="tnum font-semibold text-accent">
                  ${(gap * 14).toFixed(2)}
                </span>{" "}
                on a 14-gallon fill.
              </>
            ) : (
              <> — both warehouses are at the same price.</>
            )}
          </p>
          {cheapest.last_checked_at && (
            <p className="mt-1 text-xs text-muted">
              Last checked{" "}
              {new Date(cheapest.last_checked_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </section>
      )}

      {stations.length === 0 ? (
        <EmptyNotice />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {stations.map((s) => (
            <StationCard
              key={s.station_id}
              station={s}
              isCheapest={cheapest?.station_id === s.station_id && (gap ?? 0) > 0}
              previousRegular={previous.get(s.station_id) ?? null}
            />
          ))}
        </section>
      )}

      <HistoryChart data={daily} />

      {stats && (
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          <Stat label="30-day low" value={`$${stats.low.toFixed(3)}`} />
          <Stat label="30-day high" value={`$${stats.high.toFixed(3)}`} />
          <Stat label="30-day average" value={`$${stats.avg.toFixed(3)}`} />
          <Stat label="Days tracked" value={String(stats.daysTracked)} />
        </section>
      )}

      <ChangeLog changes={changes} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="tnum mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  );
}

function summarize(daily: { day: string; regular: number | null }[]) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const key = cutoff.toISOString().slice(0, 10);

  const values = daily
    .filter((d) => d.day >= key && d.regular != null)
    .map((d) => d.regular!);
  if (values.length === 0) return null;

  return {
    low: Math.min(...values),
    high: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    daysTracked: new Set(daily.map((d) => d.day)).size,
  };
}

function SetupNotice() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h1 className="text-lg font-semibold">Not configured yet</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,
        run the migration in{" "}
        <code className="font-mono text-xs">supabase/migrations/</code>, then run{" "}
        <code className="font-mono text-xs">npm run scrape</code>. See the README.
      </p>
    </div>
  );
}

function EmptyNotice() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <p className="text-sm text-muted">
        No stations found. Run the migration to seed warehouses #377 and #648,
        then run <code className="font-mono text-xs">npm run scrape</code>.
      </p>
    </div>
  );
}
