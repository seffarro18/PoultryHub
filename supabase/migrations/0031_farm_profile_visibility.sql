-- PoultryHub — migration 0031: let farm-mates see each other's profile.
--
-- Root cause of "Feed Remaining always shows 0 Sack for Staff even though
-- Farm Admin's Feed Inventory shows the batch correctly": every list query
-- in this app that shows "Recorded By"/"Reviewed By" embeds the author's
-- profile via a nested select (e.g. feeds' `recorded_by_profile:profiles!
-- recorded_by ( name )`). `profiles` RLS has only ever granted:
--   - "Users can view own profile" (auth.uid() = id)
--   - "Super Admin can view all profiles"
--   - "Farm Admin can view their farm's staff" / "Manager can view their
--     farm's staff" (0001_02/0011 — role = 'Staff' only, one direction)
-- There was never a policy letting Staff view a Farm Admin/Manager's
-- profile. Feed batches are always recorded_by a Farm Admin/Manager (Staff
-- has no insert rights on `feeds` at all) — so for Staff, the embedded
-- `profiles` lookup on every single feed batch row was denied by RLS, and
-- PostgREST drops the parent row entirely when a to-one embedded resource's
-- RLS excludes it (not just the nested field) — producing an empty array
-- from listFeedBatches() for Staff regardless of how much stock actually
-- exists. The same gap silently affected every other "recorded by someone
-- else" list this app has (egg_production, mortality_records, tasks,
-- vitamin_administration, poultry_inventory_events, etc.) whenever the
-- viewer and the record's author are different roles — this migration
-- closes the gap for all of them at once, at its actual source, rather
-- than patching each query individually.
--
-- Scope: same farm only, via the existing current_farm_id() architecture —
-- never cross-farm. This is a superset of (and lives alongside) the two
-- existing narrower policies, which can stay as-is (multiple permissive
-- policies on the same table are OR'd together by Postgres).
--
-- Depends on 0001_01_users_auth.sql (current_user_role), 0001_02_farms.sql
-- (current_farm_id).

drop policy if exists "Farm members can view their farm's colleagues" on public.profiles;
create policy "Farm members can view their farm's colleagues"
  on public.profiles for select
  using (
    public.current_user_role() in ('Farm Admin', 'Manager', 'Staff')
    and farm_id is not null
    and farm_id = public.current_farm_id()
  );

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0031_farm_profile_visibility')
on conflict (version) do nothing;
