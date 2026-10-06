-- PoultryHub — migration 0039: System Integrity Check (Super Admin diagnostic)
--
-- One security-definer RPC, run_system_integrity_check(), performing a
-- fixed set of read-only invariant checks across the live database and
-- returning one row per check — never silently papered over as a UI "0" on
-- a failed query (see AGENTS.md's "never hide database errors" principle):
-- a failing check surfaces real affected rows, and a permission/connection
-- failure surfaces as a thrown Postgres error the client renders directly,
-- never as a false "all clear".
--
-- Restricted to Super Admin via an explicit role check inside the function
-- body (same pattern as save_egg_sale in 0024) rather than relying on RLS —
-- this function deliberately reads across every farm, which is exactly what
-- Super Admin oversight requires and exactly what RLS would otherwise block.
--
-- Depends on: 0001_04_poultry_inventory.sql (poultry_inventory_events),
-- 0001_05_feeds_vitamins.sql (feeds/vitamins), 0015_poultry_houses.sql
-- (poultry_houses), 0024_sales_multi_item.sql (sale_items), 0038_poultry_
-- event_status_mapping.sql (status/event_type CHECK — check 5 below should
-- always report 0 once that migration is applied; its presence here is a
-- regression tripwire, not new enforcement).

create or replace function public.run_system_integrity_check()
returns table (
  check_name text,
  status text,
  detail text,
  affected_count int
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'Super Admin'
  ) then
    raise exception 'Only Super Admin can run the system integrity check.';
  end if;

  -- 1. No negative poultry stock (per farm + bird type), signed the same
  --    way poultryInventoryService.ts's currentStockByType already does.
  return query
  select
    'Negative poultry stock'::text,
    case when count(*) = 0 then 'ok' else 'critical' end,
    case when count(*) = 0 then 'Every farm/bird-type combination has non-negative derived stock.'
         else count(*) || ' farm/bird-type combination(s) have negative derived stock.' end,
    count(*)::int
  from (
    select farm_id, bird_type,
      sum(case when event_type in ('sale', 'culling', 'mortality') then -quantity else quantity end) as stock
    from public.poultry_inventory_events
    where event_type <> 'transfer'
    group by farm_id, bird_type
    having sum(case when event_type in ('sale', 'culling', 'mortality') then -quantity else quantity end) < 0
  ) negative_stock;

  -- 2. No negative feed batch stock.
  return query
  select
    'Negative feed stock'::text,
    case when count(*) = 0 then 'ok' else 'critical' end,
    case when count(*) = 0 then 'Every feed batch has non-negative remaining stock.'
         else count(*) || ' feed batch(es) have negative remaining stock.' end,
    count(*)::int
  from public.feeds
  where remaining_stock < 0;

  -- 3. No negative vitamin batch stock.
  return query
  select
    'Negative vitamin stock'::text,
    case when count(*) = 0 then 'ok' else 'critical' end,
    case when count(*) = 0 then 'Every vitamin batch has non-negative remaining stock.'
         else count(*) || ' vitamin batch(es) have negative remaining stock.' end,
    count(*)::int
  from public.vitamins
  where remaining_stock < 0;

  -- 4. No duplicate house/pen names within the same farm (same normalization
  --    as normalizeHouseName() in poultryHouse.ts — case/whitespace/
  --    underscore/hyphen-insensitive).
  return query
  select
    'Duplicate house/pen names'::text,
    case when count(*) = 0 then 'ok' else 'warning' end,
    case when count(*) = 0 then 'Every house/pen name is unique within its farm.'
         else count(*) || ' duplicate house/pen name group(s) found.' end,
    count(*)::int
  from (
    select farm_id, lower(regexp_replace(trim(name), '[\s_-]+', ' ', 'g')) as normalized
    from public.poultry_houses
    group by farm_id, lower(regexp_replace(trim(name), '[\s_-]+', ' ', 'g'))
    having count(*) > 1
  ) dup_houses;

  -- 5. Event Type -> Status invariant — regression tripwire for 0038's own
  --    CHECK constraint, not new enforcement.
  return query
  select
    'Event type / status mismatch'::text,
    case when count(*) = 0 then 'ok' else 'critical' end,
    case when count(*) = 0 then 'Every poultry inventory event''s status matches its event type.'
         else count(*) || ' event(s) have a status that doesn''t match their event type.' end,
    count(*)::int
  from public.poultry_inventory_events
  where event_type <> 'mortality' and status is distinct from case event_type
    when 'arrival' then 'Active'
    when 'transfer' then 'Transferred'
    when 'sale' then 'Sold'
    when 'culling' then 'Culled'
    when 'count_update' then 'Active'
    else status
  end;

  -- 6. Multi-item sale totals match the sum of their line items.
  return query
  select
    'Sale totals'::text,
    case when count(*) = 0 then 'ok' else 'critical' end,
    case when count(*) = 0 then 'Every multi-item sale''s total matches the sum of its line items.'
         else count(*) || ' sale(s) have a total that doesn''t match their line items.' end,
    count(*)::int
  from (
    select s.id
    from public.sales s
    join public.sale_items si on si.sale_id = s.id
    group by s.id, s.total_amount
    having abs(s.total_amount - sum(si.line_total)) > 0.01
  ) bad_sales;

  -- 7. No farm-scoped record missing its farm_id (NOT NULL already enforces
  --    this at the column level — this is a tripwire in case a future
  --    migration ever relaxes that, not evidence it's currently possible).
  return query
  select
    'Orphaned records (missing farm)'::text,
    case when count(*) = 0 then 'ok' else 'critical' end,
    case when count(*) = 0 then 'Every production/inventory/sales/task record is tied to a farm.'
         else count(*) || ' record(s) across core tables have no farm_id.' end,
    count(*)::int
  from (
    select id from public.egg_production where farm_id is null
    union all
    select id from public.poultry_inventory_events where farm_id is null
    union all
    select id from public.tasks where farm_id is null
    union all
    select id from public.sales where farm_id is null
    union all
    select id from public.expenses where farm_id is null
  ) orphans;
end;
$$;

revoke all on function public.run_system_integrity_check() from public;
grant execute on function public.run_system_integrity_check() to authenticated;

insert into public.schema_migrations (version) values ('0039_system_integrity_check')
on conflict (version) do nothing;
