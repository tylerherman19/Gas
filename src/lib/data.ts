import { supabase } from "./supabase";
import type { DailyPoint, PriceChange, Station } from "./types";

/** Costco warehouse numbers we track, in display order. */
export const TRACKED: { station_id: number; label: string }[] = [
  { station_id: 377, label: "St Louis Park" },
  { station_id: 648, label: "Maple Grove" },
];

export async function getStations(): Promise<Station[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("costco_gas_latest")
    .select("*")
    .order("station_id");

  if (error) {
    console.error("getStations:", error.message);
    return [];
  }

  // Preserve the order in TRACKED rather than whatever Postgres returns.
  const order = new Map(TRACKED.map((t, i) => [t.station_id, i]));
  return (data ?? []).sort(
    (a, b) => (order.get(a.station_id) ?? 99) - (order.get(b.station_id) ?? 99),
  );
}

export async function getDaily(days: number): Promise<DailyPoint[]> {
  if (!supabase) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("costco_gas_daily")
    .select("station_id, day, regular, premium")
    .gte("day", since.toISOString().slice(0, 10))
    .order("day");

  if (error) {
    console.error("getDaily:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Recent price moves across both stations, each paired with the reading it
 * replaced so the UI can show the delta.
 */
export async function getRecentChanges(limit = 20): Promise<PriceChange[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("costco_gas_prices")
    .select("station_id, observed_at, regular, premium")
    .order("observed_at", { ascending: false })
    .limit(limit * 2);

  if (error) {
    console.error("getRecentChanges:", error.message);
    return [];
  }

  const seenByStation = new Map<number, number | null>();
  const out: PriceChange[] = [];

  // Rows arrive newest-first, so walking oldest-first lets us attach the
  // previous reading for each station as we go.
  for (const row of [...(data ?? [])].reverse()) {
    out.push({ ...row, previous_regular: seenByStation.get(row.station_id) ?? null });
    seenByStation.set(row.station_id, row.regular);
  }

  return out.reverse().slice(0, limit);
}
