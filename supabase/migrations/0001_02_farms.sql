-- PoultryHub — migration 0001_02: farms.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers the
-- "farms" category: the `farms` table itself, Farm Management's descriptive
-- fields (owner/address/contact/type/capacity/status) and Locations'
-- geographic fields (farm_code/latitude/longitude), plus Staff Management's
-- HR fields on `profiles` (they're gated by which farm a Staff account
-- belongs to, so they live here rather than in users_auth). Depends on
-- 0001_01_users_auth.sql having already run (uses is_super_admin(),
-- current_user_role(), prevent_self_privilege_escalation(),
-- handle_updated_at()).
--
-- No "poultry_houses" table exists — house/pen is just a free-text field on
-- individual records (egg_production.house_pen, poultry_inventory_events'
-- from/to_house_pen, etc.), never its own entity. Nothing to split out here.

-- ── farms ────────────────────────────────────────────────────────────────
-- Starts minimal (just a name) — Farm Management's fuller fields (owner,
-- location, capacity, status, ...) are added further down as their own
-- section, same nullable/progressive-fill approach as everywhere else.

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_farms_updated_at on public.farms;
create trigger set_farms_updated_at
  before update on public.farms
  for each row execute procedure public.handle_updated_at();

alter table public.farms enable row level security;

drop policy if exists "Super Admin can manage farms" on public.farms;
create policy "Super Admin can manage farms"
  on public.farms for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Which farm a Farm Admin/Manager/Staff account belongs to. Nullable —
-- unassigned until a Super Admin sets it from the Users page. Guarded by
-- prevent_self_privilege_escalation() (0001_01), same as role/status: nobody
-- can reassign their own farm through the app.
alter table public.profiles add column if not exists farm_id uuid references public.farms (id) on delete set null;
create index if not exists profiles_farm_id_idx on public.profiles (farm_id);

-- security definer, same reasoning as is_super_admin(): lets RLS policies
-- read the caller's farm assignment without re-triggering RLS on profiles.
create or replace function public.current_farm_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select farm_id from public.profiles where id = auth.uid();
$$;

drop policy if exists "Farm users can view their assigned farm" on public.farms;
create policy "Farm users can view their assigned farm"
  on public.farms for select
  using (id = public.current_farm_id());

-- ── Staff Management (Farm Admin) ───────────────────────────────────────
-- HR fields Farm Admin maintains for their farm's Staff accounts. All
-- optional/nullable — filled in progressively, no CRUD forces every field.
alter table public.profiles add column if not exists employee_id text;
alter table public.profiles add column if not exists contact_number text;
alter table public.profiles add column if not exists position text;
alter table public.profiles add column if not exists employment_status text;
alter table public.profiles add column if not exists assigned_house_pen text;
alter table public.profiles add column if not exists username text;

-- Row-visibility only — prevent_self_privilege_escalation() (0001_01) is
-- what actually restricts which columns Farm Admin can change. farm_id is
-- null is included so Farm Admin can see (and then claim) a Staff account
-- that self-registered and hasn't been assigned to any farm yet.
drop policy if exists "Farm Admin can view their farm's staff" on public.profiles;
create policy "Farm Admin can view their farm's staff"
  on public.profiles for select
  using (
    public.current_user_role() = 'Farm Admin'
    and role = 'Staff'
    and (farm_id = public.current_farm_id() or farm_id is null)
  );

drop policy if exists "Farm Admin can manage their farm's staff" on public.profiles;
create policy "Farm Admin can manage their farm's staff"
  on public.profiles for update
  using (
    public.current_user_role() = 'Farm Admin'
    and role = 'Staff'
    and (farm_id = public.current_farm_id() or farm_id is null)
  );

-- Per-farm toggle a Farm Admin controls for their own farm only — "unless
-- permitted by the Farm Admin" made real rather than a process-only
-- convention. Created before poultry_inventory_events' RLS policies (which
-- reference it) in 0001_04 — a CREATE POLICY expression is validated against
-- the live schema immediately (unlike a plpgsql function body), so this
-- column must exist before any policy references it.
alter table public.farms add column if not exists staff_can_delete_inventory boolean not null default false;

-- ── Farm Management fields ──────────────────────────────────────────────
-- Nullable/progressive-fill, same reasoning as Staff Management's HR fields
-- — a farm can be registered with just a name and filled in later. `status`
-- is the one required field, defaulting to 'active' so existing farms and
-- the FarmSelect quick-create flow (still just {name}) keep working
-- unchanged. `farm_type` is deliberately unconstrained text, not a CHECK
-- list — there's no existing taxonomy to anchor it to (unlike bird_type).
alter table public.farms add column if not exists owner text;
-- `address` is just the street/barangay/building detail line — region,
-- province, and city are structured (below) so location stays filterable,
-- picked from the `ph-locations` package's bundled PSGC dataset client-side
-- rather than free-typed, so there's no drift between how two farms in the
-- same city end up spelled.
alter table public.farms add column if not exists address text;
alter table public.farms add column if not exists region text;
alter table public.farms add column if not exists province text;
alter table public.farms add column if not exists city text;
alter table public.farms add column if not exists contact_number text;
alter table public.farms add column if not exists email text;
alter table public.farms add column if not exists farm_type text;
alter table public.farms add column if not exists capacity int check (capacity is null or capacity >= 0);
alter table public.farms add column if not exists status text not null default 'active' check (status in ('active', 'inactive', 'archived'));

-- Locations module (Super Admin's read-only geographic map). No separate
-- table — it reads farms directly. farm_code is a Super-Admin-entered
-- reference string (nothing generates one); lat/lng are set from this same
-- Farms module's edit form (a click-to-pin mini-map + numeric inputs) since
-- the Locations page itself is explicitly read-only.
alter table public.farms add column if not exists farm_code text;
alter table public.farms add column if not exists latitude double precision check (latitude is null or latitude between -90 and 90);
alter table public.farms add column if not exists longitude double precision check (longitude is null or longitude between -180 and 180);

create index if not exists farms_status_idx on public.farms (status);
create index if not exists farms_region_idx on public.farms (region);
create index if not exists farms_province_idx on public.farms (province);
create index if not exists farms_city_idx on public.farms (city);

-- Same shape as prevent_self_privilege_escalation(): lets a Farm Admin
-- update *only* the staff_can_delete_inventory flag on their own farm row.
-- Explicit allowlist (everything else raises), not just a name check — once
-- Farm Management added owner/address/contact/email/farm_type/capacity/
-- status above, a denylist-of-just-name would have silently let a Farm
-- Admin edit all of those too. Everyone else keeps today's behavior (Super
-- Admin unrestricted, everyone else blocked).
create or replace function public.prevent_farm_field_overreach()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if public.current_user_role() = 'Farm Admin' and old.id = public.current_farm_id() then
    if new.name is distinct from old.name
       or new.owner is distinct from old.owner
       or new.address is distinct from old.address
       or new.region is distinct from old.region
       or new.province is distinct from old.province
       or new.city is distinct from old.city
       or new.contact_number is distinct from old.contact_number
       or new.email is distinct from old.email
       or new.farm_type is distinct from old.farm_type
       or new.capacity is distinct from old.capacity
       or new.status is distinct from old.status
       or new.farm_code is distinct from old.farm_code
       or new.latitude is distinct from old.latitude
       or new.longitude is distinct from old.longitude then
      raise exception 'Only a Super Admin can update farm information';
    end if;
    return new;
  end if;

  raise exception 'Only a Super Admin can update farm records';
end;
$$;

drop trigger if exists enforce_farm_field_overreach on public.farms;
create trigger enforce_farm_field_overreach
  before update on public.farms
  for each row execute procedure public.prevent_farm_field_overreach();

drop policy if exists "Farm Admin can update their own farm's staff permissions" on public.farms;
create policy "Farm Admin can update their own farm's staff permissions"
  on public.farms for update
  using (public.current_user_role() = 'Farm Admin' and id = public.current_farm_id())
  with check (id = public.current_farm_id());

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_02_farms')
on conflict (version) do nothing;
