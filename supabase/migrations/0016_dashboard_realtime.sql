-- PoultryHub — migration 0016: enable Realtime on the tables the Farm Admin
-- Dashboard's cards/charts actually read, so it can update live instead of
-- only on a manual reload.
--
-- egg_production, notifications, and tasks are already in the
-- supabase_realtime publication (confirmed via pg_publication_tables before
-- writing this file) — this adds exactly the rest of what
-- farmDashboardService.ts's fetchFarmDashboardData() reads: sales, expenses,
-- feeds, vitamins, mortality_records, poultry_inventory_events (Total
-- Chickens), and feed_distribution (the Feed Consumption chart). Each guard
-- checks pg_publication_tables first — "alter publication ... add table"
-- errors if the table is already a member, unlike this project's usual
-- "if not exists" DDL.

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'sales') then
    alter publication supabase_realtime add table public.sales;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'expenses') then
    alter publication supabase_realtime add table public.expenses;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'feeds') then
    alter publication supabase_realtime add table public.feeds;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'vitamins') then
    alter publication supabase_realtime add table public.vitamins;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'mortality_records') then
    alter publication supabase_realtime add table public.mortality_records;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'poultry_inventory_events') then
    alter publication supabase_realtime add table public.poultry_inventory_events;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'feed_distribution') then
    alter publication supabase_realtime add table public.feed_distribution;
  end if;
end $$;

insert into public.schema_migrations (version) values ('0016_dashboard_realtime')
on conflict (version) do nothing;
