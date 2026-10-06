-- PoultryHub — migration 0033: Staff can only record Feed Distribution
-- against their own assigned Poultry House/Pen, enforced at the database.
--
-- Previously feed_distribution.house_id could be any house belonging to
-- the caller's farm (same shape as egg_production.poultry_house_id's own
-- RLS check, 0015) — the UI restricted Staff to a single dropdown option,
-- but nothing stopped a crafted request from inserting a different house_id
-- in the same farm. This tightens Staff's own insert/update policies to
-- require house_id = the caller's profiles.assigned_poultry_house_id
-- exactly — a mismatched or missing house_id is rejected by RLS itself, not
-- just hidden in the UI. Farm Admin/Manager's own policies are untouched —
-- they still pick any house/pen freely when recording their own usage.
--
-- Also drops "Number of Chickens Fed" per this feature's own spec — the
-- Record Feed Distribution modal no longer collects it for either role, so
-- the column is relaxed to nullable (kept, not dropped, so historical rows
-- with a real value are preserved) rather than removed outright.
--
-- Depends on 0001_05_feeds_vitamins.sql (feed_distribution),
-- 0017_staff_poultry_house_assignment.sql (profiles.assigned_poultry_house_id),
-- 0032_feed_distribution_house_id.sql (feed_distribution.house_id).

drop policy if exists "Staff can record feed distribution for their farm" on public.feed_distribution;
create policy "Staff can record feed distribution for their farm"
  on public.feed_distribution for insert
  with check (
    farm_id = public.current_farm_id()
    and public.current_user_role() = 'Staff'
    and house_id is not null
    and house_id = (select assigned_poultry_house_id from public.profiles where id = auth.uid())
  );

drop policy if exists "Staff can edit their own pending or rejected feed distribution" on public.feed_distribution;
create policy "Staff can edit their own pending or rejected feed distribution"
  on public.feed_distribution for update
  using (
    recorded_by = auth.uid()
    and status in ('pending', 'rejected')
    and public.current_user_role() = 'Staff'
  )
  with check (
    recorded_by = auth.uid()
    and farm_id = public.current_farm_id()
    and status in ('pending', 'rejected')
    and house_id is not null
    and house_id = (select assigned_poultry_house_id from public.profiles where id = auth.uid())
  );

alter table public.feed_distribution alter column number_of_chickens drop not null;
alter table public.feed_distribution drop constraint if exists feed_distribution_number_of_chickens_check;
alter table public.feed_distribution add constraint feed_distribution_number_of_chickens_check
  check (number_of_chickens is null or number_of_chickens > 0);

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0033_feed_distribution_assigned_house_only')
on conflict (version) do nothing;
