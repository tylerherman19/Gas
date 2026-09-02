import { supabase } from "./supabase";
import type { DailyPoint, PriceChange, Station } from "./types";
import { dateKeyDaysAgo } from "./dates";

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

  const { data, error } = await supabase
    .from("costco_gas_daily")
    .select("station_id, day, regular, premium")
    .gte("day", dateKeyDaysAgo(days))
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
  const client = supabase;

  const results = await Promise.all(
    TRACKED.map(async ({ station_id }) => {
      const { data, error } = await client
        .from("costco_gas_prices")
        .select("station_id, observed_at, regular, premium")
        .eq("station_id", station_id)
        .order("observed_at", { ascending: false })
        // One extra row guarantees a previous value for every displayed row.
        .limit(limit + 1);

      if (error) throw error;

      return (data ?? []).map((row, index) => ({
        ...row,
        previous_regular: data[index + 1]?.regular ?? null,
      }));
    }),
  ).catch((error) => {
    console.error("getRecentChanges:", error.message);
    return [];
  });

  return results.flat().sort((a, b) => b.observed_at.localeCompare(a.observed_at)).slice(0, limit);
}
