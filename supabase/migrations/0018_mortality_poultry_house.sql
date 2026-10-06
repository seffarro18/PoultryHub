-- PoultryHub — migration 0018: link mortality_records to a real poultry
-- house/pen, same treatment egg_production got in 0015. house_pen (text) is
-- kept, not dropped — Super Admin's Mortality Records oversight and
-- Farm/Staff mortality panels inside Poultry Inventory both still read it
-- as plain text, untouched by this migration; poultry_house_id is written
-- alongside it (set to the selected house's name at save time) so nothing
-- reading house_pen as text needs to change.

alter table public.mortality_records add column if not exists poultry_house_id uuid references public.poultry_houses (id) on delete set null;
create index if not exists mortality_records_poultry_house_id_idx on public.mortality_records (poultry_house_id);

-- Extend the existing insert/update policies exactly like 0015 did for
-- egg_production — a submitted poultry_house_id must belong to the same
-- farm as the record itself. Re-issuing each policy in full (drop + create).
drop policy if exists "Staff can record mortality for their farm" on public.mortality_records;
create policy "Staff can record mortality for their farm"
  on public.mortality_records for insert
  with check (
    farm_id = public.current_farm_id()
    and public.current_user_role() = 'Staff'
    and status = 'pending'
    and (poultry_house_id is null or exists (
      select 1 from public.poultry_houses ph where ph.id = poultry_house_id and ph.farm_id = public.current_farm_id()
    ))
  );

drop policy if exists "Staff can edit their own pending or rejected mortality records" on public.mortality_records;
create policy "Staff can edit their own pending or rejected mortality records"
  on public.mortality_records for update
  using (
    recorded_by = auth.uid()
    and status in ('pending', 'rejected')
    and public.current_user_role() = 'Staff'
  )
  with check (
    recorded_by = auth.uid()
    and farm_id = public.current_farm_id()
    and status in ('pending', 'rejected')
    and (poultry_house_id is null or exists (
      select 1 from public.poultry_houses ph where ph.id = poultry_house_id and ph.farm_id = public.current_farm_id()
    ))
  );

drop policy if exists "Farm Admin or Manager can record mortality for their farm" on public.mortality_records;
create policy "Farm Admin or Manager can record mortality for their farm"
  on public.mortality_records for insert
  with check (
    farm_id = public.current_farm_id()
    and public.current_user_role() in ('Farm Admin', 'Manager')
    and (poultry_house_id is null or exists (
      select 1 from public.poultry_houses ph where ph.id = poultry_house_id and ph.farm_id = public.current_farm_id()
    ))
  );

drop policy if exists "Farm Admin or Manager can manage their farm's mortality records" on public.mortality_records;
create policy "Farm Admin or Manager can manage their farm's mortality records"
  on public.mortality_records for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (
    farm_id = public.current_farm_id()
    and (poultry_house_id is null or exists (
      select 1 from public.poultry_houses ph where ph.id = poultry_house_id and ph.farm_id = public.current_farm_id()
    ))
  );

insert into public.schema_migrations (version) values ('0018_mortality_poultry_house')
on conflict (version) do nothing;
