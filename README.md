# The Costco Gas Index

Live tracker and price history for the two Twin Cities Costco gas stations:
**#377 St Louis Park** and **#648 Maple Grove**.

Tracks regular and premium at both warehouses, the 7-day change for each, and
a spread chart shaded in favour of whichever warehouse is cheaper on any given
day.

The design is an editorial broadsheet: cream paper, Instrument Serif
headlines, JetBrains Mono for figures, and one colour per warehouse
(Costco red for St Louis Park, Costco blue for Maple Grove) carried
consistently through every chart, panel and ledger row. Light mode only.

## How the prices are sourced

Costco doesn't publish gas prices centrally — they're buried on individual
warehouse pages. The site calls an undocumented endpoint behind the scenes:

```
GET https://www.costco.com/AjaxGetGasPricesService?warehouseid=377_648

{"377":{"premium":"4.729","regular":"3.929"},
 "648":{"premium":"4.499","regular":"3.819"}}
```

Things worth knowing about it:

- The parameter is lowercase **`warehouseid`**. Other spellings silently
  return `{"errorMessage":"warehouse id supplied, , is not a number"}`.
- Multiple warehouse numbers are joined with **underscores**.
- It caps out at roughly **10 warehouses per call** and quietly drops the rest,
  so `scripts/scrape.mjs` batches in tens.
- Requests without a browser-shaped `User-Agent` and `Referer` are dropped.
- Unknown warehouse numbers come back as `{"999999":{}}` rather than an error.

Costco's other endpoint, `AjaxWarehouseBrowseLookupView` (the lat/lng one that
also returns addresses and hours), sits behind Akamai and returns **403 from
datacenter IPs** — including GitHub Actions runners. `AjaxGetGasPricesService`
does not, which is why this project uses it and hardcodes the two warehouses'
coordinates in the migration instead.

## Setup

### 1. Database

Run `supabase/migrations/20260902000000_costco_gas.sql` in the Supabase SQL
editor of your existing fantasy football project. Everything is prefixed
`costco_gas_` so it sits alongside the existing tables without colliding.

It creates:

| Object | Purpose |
| --- | --- |
| `costco_gas_stations` | The tracked warehouses, seeded with #377 and #648 |
| `costco_gas_prices` | Append-only log, one row per observed price change |
| `costco_gas_latest` | View: most recent reading per station |
| `costco_gas_daily` | View: forward-filled daily series for the chart |

Row level security is on, with public read access and writes reserved for the
service role.

### 2. Environment

Copy `.env.example` to `.env.local` and fill in the values from
**Supabase → Project settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3. Collect prices

Test the Costco fetch without touching the database:

```bash
npm run scrape -- --dry-run
```

Then, with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set:

```bash
npm run scrape
```

The scraper writes a row only when a price actually moves, so the table stays a
clean change log instead of a pile of identical readings.

### 4. Schedule it

`.github/workflows/scrape.yml` runs every 3 hours. Add two repository secrets
under **Settings → Secrets and variables → Actions**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (service role, not anon — it needs to bypass RLS)

### 5. Run the site

```bash
npm install
npm run dev
```

### Deploying to Vercel

The page is a server component that reads Supabase and revalidates every 10
minutes, so you deploy once and it keeps itself current — no rebuild per
price change.

1. At [vercel.com/new](https://vercel.com/new), import this repository.
   Vercel detects Next.js on its own; `vercel.json` pins the framework and
   region (`iad1`) and sets a couple of security headers.
2. Under **Settings → Environment Variables**, add for all environments:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon (public) key |

   Only these two. The service role key belongs in GitHub Actions secrets and
   must never reach the frontend.
3. Deploy. Pushes to this branch redeploy automatically.

Prefer the CLI:

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel --prod
```

GitHub Pages was considered and rejected: it is static-only, so the Supabase
read would have to move into the browser, or a full rebuild-and-redeploy
would have to be appended to every scrape run.

## Notes

History starts accumulating the first time the scraper runs — there's no
backfill, because Costco only exposes current prices. The chart fills in as
days pass.

Not affiliated with Costco Wholesale.
