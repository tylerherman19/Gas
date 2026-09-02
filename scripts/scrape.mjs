#!/usr/bin/env node
/**
 * Polls Costco for current gas prices and records any changes in Supabase.
 *
 * The endpoint is undocumented. Two things about it matter:
 *   1. The parameter is lowercase `warehouseid`, and multiple warehouse
 *      numbers are joined with underscores: `?warehouseid=377_648`.
 *   2. It drops requests that don't look like a browser, so the User-Agent
 *      and Referer below are required, not decorative.
 *
 * Unlike Costco's AjaxWarehouseBrowseLookupView (which is behind Akamai and
 * 403s from datacenter IPs), this one answers fine from CI.
 *
 * Usage: node scripts/scrape.mjs
 */

import { createClient } from "@supabase/supabase-js";

/** `--dry-run` fetches from Costco and prints, touching no database. */
const DRY_RUN = process.argv.includes("--dry-run");

/** Warehouses used by --dry-run, before the database exists. */
const DEFAULT_STATIONS = [
  { station_id: 377, name: "St Louis Park" },
  { station_id: 648, name: "Maple Grove" },
];

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with --dry-run to test the Costco fetch without a database.",
  );
  process.exit(1);
}

const COSTCO_ENDPOINT = "https://www.costco.com/AjaxGetGasPricesService";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.costco.com/warehouse-locations",
};

const GRADES = ["regular", "premium", "diesel"];

const supabase = DRY_RUN
  ? null
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Costco returns prices as strings ("3.929"); empty/missing means not sold. */
function parsePrice(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchPrices(stationIds, attempt = 1) {
  const url = `${COSTCO_ENDPOINT}?warehouseid=${stationIds.join("_")}`;
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (!text.trim()) throw new Error("empty response body");

    const body = JSON.parse(text);
    if (body.errorMessage) throw new Error(`Costco error: ${body.errorMessage}`);
    return body;
  } catch (err) {
    if (attempt >= 4) throw err;
    const backoff = 2 ** attempt * 1000;
    console.warn(`  attempt ${attempt} failed (${err.message}); retrying in ${backoff}ms`);
    await sleep(backoff);
    return fetchPrices(stationIds, attempt + 1);
  }
}

function sameReading(a, b) {
  if (!a || !b) return false;
  return GRADES.every((g) => {
    const x = a[g] === null || a[g] === undefined ? null : Number(a[g]);
    const y = b[g] === null || b[g] === undefined ? null : Number(b[g]);
    return x === y;
  });
}

async function loadStations() {
  if (DRY_RUN) return DEFAULT_STATIONS;

  const { data, error } = await supabase
    .from("costco_gas_stations")
    .select("station_id, name")
    .order("station_id");

  if (error) throw error;
  return data ?? [];
}

async function main() {
  const stations = await loadStations();
  if (!stations.length) {
    console.error("No stations configured. Run the migration first.");
    process.exit(1);
  }

  const ids = stations.map((s) => s.station_id);
  console.log(`Fetching prices for ${ids.length} warehouse(s): ${ids.join(", ")}`);

  // The endpoint quietly truncates long ID lists, so ask in batches of 10.
  const prices = {};
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    Object.assign(prices, await fetchPrices(batch));
    if (i + 10 < ids.length) await sleep(1000);
  }

  const observedAt = new Date().toISOString();
  const rows = [];
  let unchanged = 0;

  for (const station of stations) {
    const raw = prices[String(station.station_id)];

    // An unknown or gas-less warehouse comes back as an empty object.
    if (!raw || Object.keys(raw).length === 0) {
      console.warn(`  #${station.station_id} ${station.name}: no prices returned`);
      continue;
    }

    const reading = {
      regular: parsePrice(raw.regular),
      premium: parsePrice(raw.premium),
      diesel: parsePrice(raw.diesel),
    };

    if (GRADES.every((g) => reading[g] === null)) {
      console.warn(`  #${station.station_id} ${station.name}: all grades empty`);
      continue;
    }

    let previous = null;
    if (!DRY_RUN) {
      const { data, error } = await supabase
        .from("costco_gas_prices")
        .select("regular, premium, diesel")
        .eq("station_id", station.station_id)
        .order("observed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      previous = data;
    }

    if (sameReading(previous, reading)) {
      unchanged += 1;
      console.log(
        `  #${station.station_id} ${station.name}: unchanged at $${reading.regular?.toFixed(3)}`,
      );
      continue;
    }

    const delta =
      previous?.regular != null && reading.regular != null
        ? ` (${reading.regular > previous.regular ? "+" : ""}${(
            reading.regular - previous.regular
          ).toFixed(3)})`
        : " (first reading)";

    console.log(
      `  #${station.station_id} ${station.name}: ` +
        `regular $${reading.regular?.toFixed(3)}${delta}` +
        (reading.premium != null ? `, premium $${reading.premium.toFixed(3)}` : ""),
    );

    rows.push({ station_id: station.station_id, observed_at: observedAt, ...reading });
  }

  if (DRY_RUN) {
    console.log(`Dry run complete. ${rows.length} row(s) would be written.`);
    return;
  }

  if (rows.length) {
    const { error } = await supabase.from("costco_gas_prices").insert(rows);
    if (error) throw error;
  }

  const { error: touchError } = await supabase
    .from("costco_gas_stations")
    .update({ last_checked_at: observedAt })
    .in("station_id", ids);
  if (touchError) throw touchError;

  console.log(`Done. ${rows.length} change(s) recorded, ${unchanged} unchanged.`);
}

main().catch((err) => {
  console.error("Scrape failed:", err.message ?? err);
  process.exit(1);
});
