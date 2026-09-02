-- Keep the daily series aligned with the warehouses' local calendar.
-- This is a follow-up to the initial migration for databases where that
-- migration has already been applied.

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
