-- PoultryHub — migration 0019: enable Realtime on farms/profiles so the
-- Super Admin Dashboard's "Total Farms"/"Total Users"/"Active Managers"/
-- "Active Staff" cards (and the farm-by-farm breakdown) can update live —
-- when a new farm is registered or a staff account's status changes,
-- without a manual reload. Same idempotent guard pattern as 0016/0018.

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'farms') then
    alter publication supabase_realtime add table public.farms;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

insert into public.schema_migrations (version) values ('0019_superadmin_dashboard_realtime')
on conflict (version) do nothing;
