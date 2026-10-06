-- PoultryHub — migration 0027: Layer Breed / Strain.
--
-- Upgrades poultry_inventory_events' existing free-text `breed` column
-- (added in 0001_04_poultry_inventory.sql, shown only on "arrival" rows)
-- from a free-text input to a dropdown backed by a real catalog table —
-- `layer_breeds`. The event table itself is untouched: `breed` keeps
-- storing the chosen strain's name as plain text (same "text column,
-- optionally informed by a catalog" pattern egg_production.house_pen
-- already uses alongside poultry_house_id), so no FK, no backfill, and no
-- risk to any existing arrival record's already-recorded breed text.
--
-- `layer_breeds` holds two kinds of rows: system defaults (farm_id null —
-- the 11 commercial layer strains below, visible read-only to every farm)
-- and farm-specific custom strains (farm_id = that farm, managed by its own
-- Farm Admin/Manager). This is the only place "most common in Aurora"-style
-- claims would ever be encoded, and none are — the list is a practical
-- Philippine commercial-layer-strain default, not a verified provincial
-- prevalence ranking.
--
-- Depends on 0001_01_users_auth.sql, 0001_02_farms.sql, 0001_04_poultry_inventory.sql.

create table if not exists public.layer_breeds (
  id uuid primary key default gen_random_uuid(),
  -- null = system default, visible to every farm; set = one farm's own custom strain.
  farm_id uuid references public.farms (id) on delete cascade,
  name text not null,
  egg_color text not null default 'Other' check (egg_color in ('White', 'Brown', 'Other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, name)
);

drop trigger if exists set_layer_breeds_updated_at on public.layer_breeds;
create trigger set_layer_breeds_updated_at
  before update on public.layer_breeds
  for each row execute procedure public.handle_updated_at();

alter table public.layer_breeds enable row level security;

drop policy if exists "Super Admin can view all layer breeds" on public.layer_breeds;
create policy "Super Admin can view all layer breeds"
  on public.layer_breeds for select
  using (public.is_super_admin());

-- Every farm role sees system defaults (farm_id null) plus their own farm's
-- custom strains — a separate, broader SELECT policy from the write policy
-- below so visibility into system defaults never depends on write access.
drop policy if exists "Farm users can view system and their farm's layer breeds" on public.layer_breeds;
create policy "Farm users can view system and their farm's layer breeds"
  on public.layer_breeds for select
  using (
    farm_id is null
    or (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager', 'Staff'))
  );

drop policy if exists "Farm Admin or Manager can manage their farm's layer breeds" on public.layer_breeds;
create policy "Farm Admin or Manager can manage their farm's layer breeds"
  on public.layer_breeds for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

create index if not exists layer_breeds_farm_id_idx on public.layer_breeds (farm_id);

-- ── System-default commercial layer strains (farm_id null) ─────────────
-- Guarded by "no default rows exist yet" rather than ON CONFLICT: a unique
-- constraint never considers two NULLs a conflict, so ON CONFLICT (farm_id,
-- name) would silently re-insert these every time this file re-runs.
do $$
begin
  if not exists (select 1 from public.layer_breeds where farm_id is null) then
    insert into public.layer_breeds (farm_id, name, egg_color) values
      (null, 'Dekalb White', 'White'),
      (null, 'Lohmann LSL', 'White'),
      (null, 'Babcock White', 'White'),
      (null, 'H&N', 'White'),
      (null, 'Hy-Line White', 'White'),
      (null, 'ISA White', 'White'),
      (null, 'Dekalb Brown', 'Brown'),
      (null, 'Lohmann Brown', 'Brown'),
      (null, 'ISA Brown', 'Brown'),
      (null, 'Hy-Line Brown', 'Brown'),
      (null, 'Other Layer Strain', 'Other');
  end if;
end $$;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0027_layer_breeds')
on conflict (version) do nothing;
