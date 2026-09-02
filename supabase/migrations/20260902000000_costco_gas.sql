-- Costco gas price tracker (St Louis Park #377, Maple Grove #648)
--
-- Everything is prefixed `costco_gas_` so it coexists safely with the
-- fantasy football tables already living in this Supabase project.
--
-- Prices come from Costco's undocumented endpoint:
--   GET https://www.costco.com/AjaxGetGasPricesService?warehouseid=377_648
--   -> {"377":{"premium":"4.729","regular":"3.929"}, ...}

-- ---------------------------------------------------------------- stations

create table if not exists costco_gas_stations (
  station_id      integer primary key,          -- Costco warehouse number
  name            text        not null,
  city            text        not null,
  state           char(2)     not null,
  zip_code        text,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  last_checked_at timestamptz,
  created_at      timestamptz not null default now()
);

comment on table costco_gas_stations is
  'Costco warehouses whose gas prices we track. station_id is the real Costco warehouse number.';

-- ------------------------------------------------------------ price points

-- One row per *observed change*. The scraper polls on a schedule but only
-- writes when a price actually moves, so this table is a clean change log
-- rather than a pile of duplicate readings.
create table if not exists costco_gas_prices (
  id          bigint generated always as identity primary key,
  station_id  integer     not null references costco_gas_stations(station_id) on delete cascade,
  observed_at timestamptz not null default now(),
  regular     numeric(6,3),
  premium     numeric(6,3),
  diesel      numeric(6,3),
  source      text        not null default 'costco-api',
  constraint costco_gas_prices_has_a_price check (
    regular is not null or premium is not null or diesel is not null
  ),
  constraint costco_gas_prices_unique_reading unique (station_id, observed_at)
);

create index if not exists costco_gas_prices_station_time_idx
  on costco_gas_prices (station_id, observed_at desc);

create index if not exists costco_gas_prices_time_idx
  on costco_gas_prices (observed_at desc);

comment on table costco_gas_prices is
  'Append-only log of Costco gas price changes. A new row is written only when a grade moves.';

-- --------------------------------------------------------------- latest view

-- Most recent reading per station, joined to station metadata.
create or replace view costco_gas_latest as
select
  s.station_id,
  s.name,
  s.city,
  s.state,
  s.zip_code,
  s.latitude,
  s.longitude,
  s.last_checked_at,
  p.regular,
  p.premium,
  p.diesel,
  p.observed_at
from costco_gas_stations s
left join lateral (
  select regular, premium, diesel, observed_at
  from costco_gas_prices
  where station_id = s.station_id
  order by observed_at desc
  limit 1
) p on true;

-- ---------------------------------------------------------------- daily view

-- Forward-filled daily series: the price in effect at the end of each day,
-- carried forward across days where nothing changed. This is what the
-- history chart reads.
create or replace view costco_gas_daily as
with bounds as (
  select
    station_id,
    min((observed_at at time zone 'America/Chicago'))::date as first_day,
    (now() at time zone 'America/Chicago')::date            as last_day
  from costco_gas_prices
  group by station_id
),
days as (
  select b.station_id, d::date as day
  from bounds b,
       generate_series(b.first_day, b.last_day, interval '1 day') d
)
select
  d.station_id,
  d.day,
  p.regular,
  p.premium,
  p.diesel
from days d
left join lateral (
  select regular, premium, diesel
  from costco_gas_prices
  where station_id = d.station_id
    and observed_at < ((d.day + 1)::timestamp at time zone 'America/Chicago')
  order by observed_at desc
  limit 1
) p on true;

-- ------------------------------------------------------------------ seeding

insert into costco_gas_stations
  (station_id, name, city, state, zip_code, latitude, longitude)
values
  (377, 'St Louis Park', 'Saint Louis Park', 'MN', '55416-1446', 44.967000, -93.354000),
  (648, 'Maple Grove',   'Maple Grove',      'MN', '55369-7200', 45.093000, -93.425000)
on conflict (station_id) do update
  set name      = excluded.name,
      city      = excluded.city,
      state     = excluded.state,
      zip_code  = excluded.zip_code,
      latitude  = excluded.latitude,
      longitude = excluded.longitude;

-- ---------------------------------------------------------------------- RLS

alter table costco_gas_stations enable row level security;
alter table costco_gas_prices   enable row level security;

-- The dashboard is public and read-only; writes go through the service role,
-- which bypasses RLS entirely.
drop policy if exists costco_gas_stations_public_read on costco_gas_stations;
create policy costco_gas_stations_public_read
  on costco_gas_stations for select
  to anon, authenticated
  using (true);

drop policy if exists costco_gas_prices_public_read on costco_gas_prices;
create policy costco_gas_prices_public_read
  on costco_gas_prices for select
  to anon, authenticated
  using (true);
