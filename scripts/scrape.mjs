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
 * The endpoint also sometimes answers 200 but silently drops a warehouse
 * from the payload. When that happens the scraper re-fetches the missing
 * station on its own, and if it's still absent the run fails loudly --
 * a stale price that looks fresh is worse than a failed run.
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

/** Thrown when Costco stays unreachable after retries. The caller treats this
 * as a soft failure: log it and move on, so a transient rate-limit never
 * fails the scheduled workflow (and never triggers a failure email). */
class TransientFetchError extends Error {}

/** Backoff for attempt n: exponential with jitter, honoring Retry-After. */
function backoffMs(attempt, retryAfterHeader) {
  if (retryAfterHeader) {
    const secs = Number(retryAfterHeader);
    if (Number.isFinite(secs) && secs > 0 && secs <= 300) return secs * 1000;
  }
  const exp = Math.min(2 ** attempt * 1000, 60_000);
  return exp + Math.floor(Math.random() * 1000);
}

async function fetchPrices(stationIds, attempt = 1) {
  const MAX_ATTEMPTS = 6;
  const url = `${COSTCO_ENDPOINT}?warehouseid=${stationIds.join("_")}`;
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) {
      const err = new Error("HTTP 429 (rate limited)");
      err.retryAfter = res.headers.get("retry-after");
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (!text.trim()) throw new Error("empty response body");

    const body = JSON.parse(text);
    if (body.errorMessage) throw new Error(`Costco error: ${body.errorMessage}`);
    return body;
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) {
      throw new TransientFetchError(
        `Costco unreachable after ${MAX_ATTEMPTS} attempts (last: ${err.message})`,
      );
    }
    const wait = backoffMs(attempt, err.retryAfter);
    console.warn(`  attempt ${attempt} failed (${err.message}); retrying in ${Math.round(wait)}ms`);
    await sleep(wait);
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

/**
 * Split-pipeline mode: the VM fetches from Costco (GitHub's runners are
 * blocked there) and hands the raw payload over through workflow_dispatch
 * inputs (INJECTED_PRICES). Validates completeness the same way the live
 * fetch does -- a partial update never gets written.
 */
function parseInjectedPrices(ids) {
  let parsed;
  try {
    parsed = JSON.parse(process.env.INJECTED_PRICES);
  } catch {
    throw new Error("INJECTED_PRICES is not valid JSON.");
  }
  const prices = {};
  for (const id of ids) {
    const raw = parsed[String(id)];
    if (!raw || Object.keys(raw).length === 0) {
      throw new Error(
        `Injected price data is missing station #${id}; refusing a partial update.`,
      );
    }
    prices[String(id)] = raw;
  }
  console.log(`Using injected price data for ${ids.length} warehouse(s): ${ids.join(", ")}`);
  return prices;
}

/** Live Costco fetch: batched requests plus the solo re-fetch fallback. */
async function collectPrices(ids, stations) {
  console.log(`Fetching prices for ${ids.length} warehouse(s): ${ids.join(", ")}`);

  // The endpoint quietly truncates long ID lists, so ask in batches of 10.
  const prices = {};
  const missing = new Set(ids);
  try {
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const body = await fetchPrices(batch);
      for (const id of batch) {
        const raw = body[String(id)];
        if (raw && Object.keys(raw).length > 0) {
          prices[String(id)] = raw;
          missing.delete(id);
        }
      }
      if (i + 10 < ids.length) await sleep(2000);
    }
  } catch (err) {
    if (err instanceof TransientFetchError) {
      // Costco is throttling us right now. This run records nothing, the
      // workflow still succeeds, and the next scheduled run picks it up.
      console.warn(`Skipping this run: ${err.message}`);
      return null;
    }
    throw err;
  }

  // Fallback: Costco sometimes answers 200 but silently drops a warehouse
  // from the payload (this is how Maple Grove went stale on 2026-09-18:
  // three runs recorded St Louis Park and quietly skipped it). Re-ask for
  // each missing station on its own -- a lone id can't be truncated, so if
  // it's still absent after that, something is really wrong.
  for (const id of [...missing]) {
    const name = stations.find((s) => s.station_id === id)?.name ?? `#${id}`;
    console.warn(`  #${id} ${name}: missing from batch response, re-fetching solo`);
    try {
      const solo = await fetchPrices([id]);
      const raw = solo[String(id)];
      if (raw && Object.keys(raw).length > 0) {
        prices[String(id)] = raw;
        missing.delete(id);
        console.log(`  #${id} ${name}: recovered via solo fetch`);
      } else {
        console.warn(`  #${id} ${name}: solo fetch also returned no data`);
      }
    } catch (err) {
      if (!(err instanceof TransientFetchError)) throw err;
      console.warn(`  #${id} ${name}: solo fetch throttled (${err.message})`);
    }
  }

  if (missing.size > 0) {
    // A station with no data after a solo re-fetch is a real problem, not
    // a transient throttle: fail loudly instead of letting the chart sit
    // on a stale price that looks fresh.
    const names = [...missing]
      .map((id) => `#${id} ${stations.find((s) => s.station_id === id)?.name ?? ""}`.trim())
      .join(", ");
    throw new Error(
      `Costco returned no price data for ${names} even after a solo re-fetch.`,
    );
  }

  return prices;
}

async function main() {
  const stations = await loadStations();
  if (!stations.length) {
    console.error("No stations configured. Run the migration first.");
    process.exit(1);
  }

  const ids = stations.map((s) => s.station_id);
  const prices = process.env.INJECTED_PRICES
    ? parseInjectedPrices(ids)
    : await collectPrices(ids, stations);
  if (!prices) return; // Costco throttling us; soft-skip like before.

  const observedAt = new Date().toISOString();
  const rows = [];
  let unchanged = 0;

  for (const station of stations) {
    const raw = prices[String(station.station_id)];

    // Unreachable in practice: the fallback above throws if any station is
    // still missing. Kept as a safety net so a station can never silently
    // vanish from the payload again.
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
