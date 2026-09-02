import type { Station } from "@/lib/types";

export default function StationCard({
  station,
  isCheapest,
  previousRegular,
}: {
  station: Station;
  isCheapest: boolean;
  previousRegular: number | null;
}) {
  const delta =
    station.regular != null && previousRegular != null
      ? station.regular - previousRegular
      : null;

  return (
    <div
      className={`relative rounded-xl border bg-surface p-5 ${
        isCheapest ? "border-accent" : "border-line"
      }`}
    >
      {isCheapest && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Cheaper
        </span>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{station.name}</h3>
        <span className="font-mono text-xs text-muted">#{station.station_id}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {station.city}, {station.state}
      </p>

      <div className="mt-4 flex items-end gap-2">
        <span className="tnum text-4xl font-semibold tracking-tight">
          {station.regular != null ? `$${station.regular.toFixed(3)}` : "—"}
        </span>
        {delta != null && delta !== 0 && (
          <span
            className="tnum mb-1.5 text-sm font-medium"
            style={{ color: delta > 0 ? "var(--up)" : "var(--down)" }}
          >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(3)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted">regular</p>

      <dl className="mt-4 flex gap-6 border-t border-line pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Premium</dt>
          <dd className="tnum font-medium">
            {station.premium != null ? `$${station.premium.toFixed(3)}` : "—"}
          </dd>
        </div>
        {station.diesel != null && (
          <div>
            <dt className="text-xs text-muted">Diesel</dt>
            <dd className="tnum font-medium">${station.diesel.toFixed(3)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
