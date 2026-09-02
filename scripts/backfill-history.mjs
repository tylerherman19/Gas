#!/usr/bin/env node
/**
 * Seeds the initial history window with verified historical change points.
 * The operation is idempotent and does not alter the public UI or station
 * metadata. Run with --dry-run to inspect the rows without writing.
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

// Times are Central Daylight Time; these are change points, not fabricated
// three-hour snapshots. Dates and prices were transcribed from the public
// historical station pages for warehouses 377 and 648.
const ROWS = [
  { station_id: 377, observed_at: "2026-08-26T17:00:00-05:00", regular: 4.069, premium: 4.799 },
  { station_id: 377, observed_at: "2026-08-27T17:00:00-05:00", regular: 3.999, premium: 4.799 },
  { station_id: 377, observed_at: "2026-08-29T16:00:00-05:00", regular: 3.969, premium: 4.749 },
  { station_id: 377, observed_at: "2026-08-30T14:00:00-05:00", regular: 3.899, premium: 4.699 },
  { station_id: 377, observed_at: "2026-08-30T21:00:00-05:00", regular: 3.929, premium: 4.729 },
  { station_id: 648, observed_at: "2026-08-26T17:00:00-05:00", regular: 3.949, premium: 4.699 },
  { station_id: 648, observed_at: "2026-08-26T23:00:00-05:00", regular: 3.929, premium: 4.649 },
  { station_id: 648, observed_at: "2026-08-27T17:00:00-05:00", regular: 3.899, premium: 4.649 },
  { station_id: 648, observed_at: "2026-08-29T16:00:00-05:00", regular: 3.899, premium: 4.599 },
  { station_id: 648, observed_at: "2026-08-30T04:00:00-05:00", regular: 3.859, premium: 4.549 },
  { station_id: 648, observed_at: "2026-08-31T18:00:00-05:00", regular: 3.819, premium: 4.499 },
].map((row) => ({ ...row, source: "historical-backfill" }));

if (DRY_RUN) {
  console.table(ROWS);
  console.log(`Dry run complete. ${ROWS.length} row(s) would be upserted.`);
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from("costco_gas_prices").upsert(ROWS, {
    onConflict: "station_id,observed_at",
    ignoreDuplicates: true,
  });

  if (error) {
    console.error(`History backfill failed: ${error.message}`);
    process.exit(1);
  }

  console.log(`History backfill complete. ${ROWS.length} row(s) are present.`);
}
