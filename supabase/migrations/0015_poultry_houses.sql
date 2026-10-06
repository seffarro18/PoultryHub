-- PoultryHub — migration 0015: poultry houses/pens as a real farm-scoped
-- entity, replacing the free-text "Poultry House / Pen" field on the Egg
-- Production form with a dropdown backed by real data.
--
-- Note: 0014 is already taken live by an untracked "0014_egg_production_realtime"
-- migration (applied via the dashboard, never committed to this repo — it
-- only enabled Realtime on egg_production, confirmed via pg_publication_tables,
-- no structural conflict with this file). This one is 0015 to avoid colliding
-- with that already-applied version.
--
-- Scoped to what the Egg Production form needs: egg_production gets a new
-- poultry_house_id FK alongside its existing house_pen text column (kept,
-- not dropped — feeds_vitamins, health_mortality, poultry_inventory_events,
-- and profiles.assigned_house_pen all still use free-text house_pen and are
-- untouched here; they can adopt poultry_houses in a later, separate
-- change). house_pen keeps being written alongside the FK (set to the
-- selected house's name at save time) so every existing reader of house_pen
-- as text — record lists, search filters, notification copy — keeps
-- working unmodified.

create table if not exists public.poultry_houses (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, name)
);

drop trigger if exists set_poultry_houses_updated_at on public.poultry_houses;
create trigger set_poultry_houses_updated_at
  before update on public.poultry_houses
  for each row execute procedure public.handle_updated_at();

alter table public.poultry_houses enable row level security;

drop policy if exists "Super Admin can view all poultry houses" on public.poultry_houses;
drop policy if exists "Farm Admin or Manager can view their farm's poultry houses" on public.poultry_houses;
drop policy if exists "Farm Admin or Manager can manage their farm's poultry houses" on public.poultry_houses;
drop policy if exists "Staff can view their farm's poultry houses" on public.poultry_houses;

-- Super Admin: read-only oversight, matching every other farm-scoped table.
create policy "Super Admin can view all poultry houses"
  on public.poultry_houses for select
  using (public.is_super_admin());

-- Farm Admin/Manager: full manage rights (create/rename/delete) over their
-- own farm's houses — "Farm Admin creates House 1" in the acceptance flow.
create policy "Farm Admin or Manager can manage their farm's poultry houses"
  on public.poultry_houses for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

-- Staff: view their own farm's houses to pick from — no create/rename/delete.
create policy "Staff can view their farm's poultry houses"
  on public.poultry_houses for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

create index if not exists poultry_houses_farm_id_idx on public.poultry_houses (farm_id);

-- ── Link egg_production to a real poultry house, without breaking the existing free-text column ──
alter table public.egg_production add column if not exists poultry_house_id uuid references public.poultry_houses (id) on delete set null;
create index if not exists egg_production_poultry_house_id_idx on public.egg_production (poultry_house_id);

-- Extend the existing insert/update policies so a submitted poultry_house_id
-- must actually belong to the record's own farm — the same "not just
-- frontend filtering" guarantee RLS already gives farm_id itself. Re-issuing
-- each policy in full (drop + create), same pattern 0001_03 already uses.
drop policy if exists "Staff can record egg production for their farm" on public.egg_production;
create policy "Staff can record egg production for their farm"
  on public.egg_production for insert
  with check (
    farm_id = public.current_farm_id()
    and public.current_user_role() = 'Staff'
    and (poultry_house_id is null or exists (
      select 1 from public.poultry_houses ph where ph.id = poultry_house_id and ph.farm_id = public.current_farm_id()
    ))
  );

drop policy if exists "Staff can edit their own pending or rejected record" on public.egg_production;
create policy "Staff can edit their own pending or rejected record"
  on public.egg_production for update
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

drop policy if exists "Farm Admin or Manager can review their farm's egg production" on public.egg_production;
create policy "Farm Admin or Manager can review their farm's egg production"
  on public.egg_production for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (
    farm_id = public.current_farm_id()
    and (poultry_house_id is null or exists (
      select 1 from public.poultry_houses ph where ph.id = poultry_house_id and ph.farm_id = public.current_farm_id()
    ))
  );

insert into public.schema_migrations (version) values ('0015_poultry_houses')
on conflict (version) do nothing;
