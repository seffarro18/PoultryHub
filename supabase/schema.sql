-- PoultryHub — historical database schema snapshot. FROZEN, do not hand-edit.
--
-- This file is no longer the source of truth. Its content was split by
-- category into supabase/migrations/0001_01_users_auth.sql through
-- 0001_12_profile_module.sql, which together are migration zero of a
-- numbered-file workflow — no CLI, nothing to install. Every schema change
-- from here on is its own small file under supabase/migrations/ (named
-- 0002_..., 0003_..., etc.), pasted by hand into the Supabase Dashboard's
-- SQL Editor, and recorded in the schema_migrations table that 0001_01
-- creates — see AGENTS.md for the full workflow. Kept here only as a
-- single-file reference of the schema as it stood the day the migrations
-- folder was adopted.
--
-- (Everything below this line is the original content, unmodified — it was
-- itself once "the single source of truth," replacing an earlier round of
-- numbered migration files (0002-0004) before this project came back around
-- to that same approach.)

-- ── Roles & account status ──────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('Super Admin', 'Farm Admin', 'Manager', 'Staff');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('pending', 'active', 'disabled');
  end if;
end $$;

-- ── profiles ─────────────────────────────────────────────────────────────
-- App-specific user data (name, role, status) alongside Supabase's built-in
-- `auth.users` table (which handles email/password).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  role public.user_role not null default 'Staff',
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'status'
  ) then
    alter table public.profiles add column status public.account_status not null default 'pending';
    -- Grandfather in every account that existed before `status` did —
    -- otherwise anyone already using the app gets locked out.
    update public.profiles set status = 'active';
  end if;
end $$;

-- Self-heal: if nobody holds the Super Admin role yet, promote whichever
-- account was created first. Only fires while zero Super Admins exist, so
-- running this file again afterward is a no-op — this is what lets a
-- deployment that's stuck with no working admin (or a fresh one) end up
-- with a Super Admin purely by running this file, no hand-written UPDATE.
do $$
declare
  bootstrap_id uuid;
begin
  if not exists (select 1 from public.profiles where role = 'Super Admin') then
    select id into bootstrap_id from public.profiles order by created_at asc limit 1;
    if bootstrap_id is not null then
      update public.profiles set role = 'Super Admin', status = 'active' where id = bootstrap_id;
    end if;
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- security definer: lets this check bypass RLS internally so policies that
-- call it don't recurse into themselves querying `profiles`.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'Super Admin'
  );
$$;

drop policy if exists "Super Admin can view all profiles" on public.profiles;
create policy "Super Admin can view all profiles"
  on public.profiles for select
  using (public.is_super_admin());

drop policy if exists "Super Admin can update all profiles" on public.profiles;
create policy "Super Admin can update all profiles"
  on public.profiles for update
  using (public.is_super_admin());

-- Blocks anyone but a Super Admin from changing role/status/farm through the
-- app (e.g. a pending account approving itself) — with one deliberate carve
-- out: a Farm Admin may activate/deactivate and claim-into-their-own-farm a
-- Staff-role account (never Manager/Farm Admin/Super Admin, never a role
-- change, never moving staff between farms or taking another farm's staff).
-- This is what "Farm Admin can create and manage staff accounts" needs —
-- Farm Admin is the approver for their own farm's staff, not Super Admin.
-- References current_user_role()/current_farm_id() defined later in this
-- file — fine, plpgsql bodies aren't validated against object existence
-- until the trigger actually fires, by which point the whole script has run.
-- auth.uid() is null when the change isn't coming through the Supabase
-- client with an end user's JWT — SQL Editor, service_role key, any other
-- direct DB connection — which is already gated by project-level
-- credentials, so that path is exempt (this is what lets you bootstrap the
-- first Super Admin from the SQL Editor).
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if public.current_user_role() = 'Farm Admin' and old.role = 'Staff' then
    if new.role is distinct from old.role then
      raise exception 'Farm Admin cannot change a staff member''s role';
    end if;
    if new.farm_id is distinct from old.farm_id then
      if not (old.farm_id is null or old.farm_id = public.current_farm_id())
         or new.farm_id is distinct from public.current_farm_id() then
        raise exception 'Farm Admin can only assign staff into their own farm';
      end if;
    end if;
    return new;
  end if;

  if (new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.farm_id is distinct from old.farm_id) then
    raise exception 'Only a Super Admin can change role, status, or farm assignment';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_role_status_immutable on public.profiles;
create trigger enforce_role_status_immutable
  before update on public.profiles
  for each row execute procedure public.prevent_self_privilege_escalation();

-- Auto-creates a profile row whenever someone signs up via supabase.auth.signUp().
-- Reads `name` / `role` out of the signup call's options.data (user metadata).
-- The very first account ever created becomes an active Super Admin
-- automatically — nobody should have to hand-write SQL just to bootstrap
-- the first admin on a fresh project. Every signup after that follows the
-- normal rule: Farm Admin/Manager/Staff start 'pending', a Super Admin
-- (never publicly selectable at signup) starts 'active'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_role public.user_role;
  new_status public.account_status;
begin
  if not exists (select 1 from public.profiles) then
    new_role := 'Super Admin';
    new_status := 'active';
  else
    new_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'Staff');
    new_status := case when new_role = 'Super Admin' then 'active' else 'pending' end;
  end if;

  insert into public.profiles (id, email, name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new_role,
    new_status
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_role_idx on public.profiles (role);

-- ── Roles & Permissions (RBAC) ──────────────────────────────────────────
-- `profiles.role` above stays the fixed backbone that drives login routing
-- and RLS — it can't be deleted or renamed. Everything below layers real
-- Create/Edit/Delete/Duplicate/Assign-Permissions functionality on top of
-- it: every role here declares which of the 4 base roles (which portal) it
-- belongs to. `permissions` is a fixed taxonomy of the app's modules, not
-- user-creatable — only `roles` and their `role_permissions` links are.

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort_order int not null default 0
);

insert into public.permissions (key, label, sort_order) values
  ('dashboard', 'Dashboard', 1),
  ('user_management', 'User Management', 2),
  ('farm_management', 'Farm Management', 3),
  ('production', 'Production', 4),
  ('inventory', 'Inventory', 5),
  ('feed_management', 'Feed Management', 6),
  ('sales', 'Sales', 7),
  ('reports', 'Reports', 8),
  ('notifications', 'Notifications', 9),
  ('audit_logs', 'Audit Logs', 10),
  ('backup', 'Backup', 11),
  ('settings', 'Settings', 12)
on conflict (key) do update set label = excluded.label, sort_order = excluded.sort_order;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  base_role public.user_role not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

-- One system role per base role, seeded with every permission — matches
-- today's real behavior (every account sees its whole portal), so this is
-- a no-op on top of what already works, not a behavior change.
insert into public.roles (name, description, base_role, is_system)
select r::text, 'Default role for ' || r::text, r, true
from unnest(enum_range(null::public.user_role)) as r
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where roles.is_system = true
on conflict do nothing;

drop trigger if exists set_roles_updated_at on public.roles;
create trigger set_roles_updated_at
  before update on public.roles
  for each row execute procedure public.handle_updated_at();

alter table public.permissions enable row level security;
drop policy if exists "Super Admin can view permissions" on public.permissions;
create policy "Super Admin can view permissions"
  on public.permissions for select
  using (public.is_super_admin());

alter table public.roles enable row level security;
drop policy if exists "Super Admin can view roles" on public.roles;
create policy "Super Admin can view roles"
  on public.roles for select
  using (public.is_super_admin());

drop policy if exists "Super Admin can insert roles" on public.roles;
create policy "Super Admin can insert roles"
  on public.roles for insert
  with check (public.is_super_admin());

drop policy if exists "Super Admin can update roles" on public.roles;
create policy "Super Admin can update roles"
  on public.roles for update
  using (public.is_super_admin());

-- System roles can't be deleted even by a Super Admin through the app —
-- an RLS-level guardrail on top of the UI hiding the button.
drop policy if exists "Super Admin can delete custom roles" on public.roles;
create policy "Super Admin can delete custom roles"
  on public.roles for delete
  using (public.is_super_admin() and is_system = false);

alter table public.role_permissions enable row level security;
drop policy if exists "Super Admin can view role_permissions" on public.role_permissions;
create policy "Super Admin can view role_permissions"
  on public.role_permissions for select
  using (public.is_super_admin());

drop policy if exists "Super Admin can insert role_permissions" on public.role_permissions;
create policy "Super Admin can insert role_permissions"
  on public.role_permissions for insert
  with check (public.is_super_admin());

drop policy if exists "Super Admin can delete role_permissions" on public.role_permissions;
create policy "Super Admin can delete role_permissions"
  on public.role_permissions for delete
  using (public.is_super_admin());

-- ── Egg Production ───────────────────────────────────────────────────────
-- `farms` here is deliberately minimal (just a name) — it exists only so
-- egg_production has something real to reference. The full Farm Management
-- module (owners, locations, capacity, status, ...) is its own future pass;
-- this isn't it, and doesn't try to be.

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
-- prevent_self_privilege_escalation() above, same as role/status: nobody
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

-- Row-visibility only — prevent_self_privilege_escalation() above is what
-- actually restricts which columns Farm Admin can change. farm_id is null
-- is included so Farm Admin can see (and then claim) a Staff account that
-- self-registered and hasn't been assigned to any farm yet.
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

create table if not exists public.egg_production (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  production_date date not null,
  house_pen text not null,
  layer_count int not null default 0 check (layer_count >= 0),
  eggs_collected int not null default 0 check (eggs_collected >= 0),
  good_eggs int not null default 0 check (good_eggs >= 0),
  cracked_eggs int not null default 0 check (cracked_eggs >= 0),
  damaged_eggs int not null default 0 check (damaged_eggs >= 0),
  eggs_sold int not null default 0 check (eggs_sold >= 0),
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- "Remaining eggs" is deliberately not a stored column — it's derived
-- (good_eggs - eggs_sold) at read time, so it can't drift out of sync
-- with an edit to either field.

drop trigger if exists set_egg_production_updated_at on public.egg_production;
create trigger set_egg_production_updated_at
  before update on public.egg_production
  for each row execute procedure public.handle_updated_at();

alter table public.egg_production enable row level security;

-- ── Staff -> Farm Admin approval workflow ───────────────────────────────
-- Staff records production (status starts 'pending'); Farm Admin/Manager
-- review, approve, reject (with a comment), or correct it; Super Admin is
-- read-only oversight across every farm — no create/edit/delete for them.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'production_status') then
    create type public.production_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'egg_production' and column_name = 'status'
  ) then
    alter table public.egg_production add column status public.production_status not null default 'pending';
    alter table public.egg_production add column review_notes text;
    alter table public.egg_production add column reviewed_by uuid references public.profiles (id) on delete set null;
    alter table public.egg_production add column reviewed_at timestamptz;
    -- Grandfather in records created before this workflow existed — they
    -- predate review entirely, so treating them as pending would be wrong.
    update public.egg_production set status = 'approved';
  end if;
end $$;

-- security definer, same reasoning as is_super_admin()/current_farm_id():
-- lets RLS tell Staff apart from Farm Admin/Manager. Not named `current_role`
-- — that's a reserved Postgres system function.
create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists "Super Admin can manage egg production" on public.egg_production;
drop policy if exists "Farm users can manage their farm's egg production" on public.egg_production;
drop policy if exists "Super Admin can view all egg production" on public.egg_production;
drop policy if exists "Staff can record egg production for their farm" on public.egg_production;
drop policy if exists "Staff can view their farm's egg production" on public.egg_production;
drop policy if exists "Staff can edit their own pending or rejected record" on public.egg_production;
drop policy if exists "Farm Admin or Manager can view their farm's egg production" on public.egg_production;
drop policy if exists "Farm Admin or Manager can review their farm's egg production" on public.egg_production;

-- Super Admin: read-only oversight, no create/edit/delete.
create policy "Super Admin can view all egg production"
  on public.egg_production for select
  using (public.is_super_admin());

-- Staff: can log new records for their own farm...
create policy "Staff can record egg production for their farm"
  on public.egg_production for insert
  with check (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

-- ...can see their farm's records...
create policy "Staff can view their farm's egg production"
  on public.egg_production for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

-- ...and can only edit their OWN record, only while pending/rejected, and the
-- resulting row must stay pending/rejected too — so there is no path, even a
-- malformed client request, where this policy alone produces an 'approved' row.
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
  );

-- Farm Admin/Manager: full view + review rights (approve/reject/correct,
-- including already-approved records) within their own farm. No insert —
-- creating records isn't part of their normal workflow.
create policy "Farm Admin or Manager can view their farm's egg production"
  on public.egg_production for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

create policy "Farm Admin or Manager can review their farm's egg production"
  on public.egg_production for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

create index if not exists egg_production_farm_id_idx on public.egg_production (farm_id);
create index if not exists egg_production_production_date_idx on public.egg_production (production_date);
create index if not exists egg_production_status_idx on public.egg_production (status);

-- ── Poultry Inventory ────────────────────────────────────────────────────
-- Stock levels are derived, not stored: "current stock" for a farm/bird type
-- is sum(quantity) over its events, computed at read time — same reasoning
-- as egg_production's derived "remaining eggs". This log is the only source
-- of truth, so it can't drift out of sync with a separately-maintained total.
-- No approval workflow here (unlike egg_production) — nothing in the spec
-- asks for one; Staff's entries take effect immediately.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'poultry_bird_type') then
    create type public.poultry_bird_type as enum ('Layer', 'Chick', 'Grower', 'Breeder');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'poultry_event_type') then
    create type public.poultry_event_type as enum ('arrival', 'transfer', 'sale', 'mortality', 'count_update');
  end if;
end $$;

create table if not exists public.poultry_inventory_events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  event_date date not null,
  bird_type public.poultry_bird_type not null,
  event_type public.poultry_event_type not null,
  -- Only a count_update correction can be negative (e.g. a recount finds
  -- fewer than recorded) — every other event type is an unsigned count.
  quantity int not null check (quantity <> 0) check (event_type = 'count_update' or quantity > 0),
  from_house_pen text,
  to_house_pen text,
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_poultry_inventory_events_updated_at on public.poultry_inventory_events;
create trigger set_poultry_inventory_events_updated_at
  before update on public.poultry_inventory_events
  for each row execute procedure public.handle_updated_at();

-- Per-farm toggle a Farm Admin controls for their own farm only — "unless
-- permitted by the Farm Admin" from the spec, made real rather than a
-- process-only convention. Created here, before the poultry_inventory_events
-- RLS policies below, because a CREATE POLICY expression is validated
-- against the live schema immediately (unlike a plpgsql function body, which
-- stays opaque until it's actually executed) — referencing this column from
-- a policy before it exists fails with "column does not exist" at creation
-- time, not just at query time.
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

alter table public.poultry_inventory_events enable row level security;

drop policy if exists "Super Admin can view all inventory events" on public.poultry_inventory_events;
create policy "Super Admin can view all inventory events"
  on public.poultry_inventory_events for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's inventory" on public.poultry_inventory_events;
create policy "Farm Admin or Manager can manage their farm's inventory"
  on public.poultry_inventory_events for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

-- Staff: can log arrivals/transfers/count updates (not sales or mortality —
-- enforced here, not just hidden in the UI, so it can't be bypassed by
-- calling the API directly)...
drop policy if exists "Staff can log limited inventory events for their farm" on public.poultry_inventory_events;
create policy "Staff can log limited inventory events for their farm"
  on public.poultry_inventory_events for insert
  with check (
    farm_id = public.current_farm_id()
    and public.current_user_role() = 'Staff'
    and event_type in ('arrival', 'transfer', 'count_update')
  );

-- ...can see the farm's whole log, including sale/mortality entries they
-- couldn't have created themselves...
drop policy if exists "Staff can view their farm's inventory events" on public.poultry_inventory_events;
create policy "Staff can view their farm's inventory events"
  on public.poultry_inventory_events for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

-- ...can correct their own entries...
drop policy if exists "Staff can edit their own inventory events" on public.poultry_inventory_events;
create policy "Staff can edit their own inventory events"
  on public.poultry_inventory_events for update
  using (recorded_by = auth.uid() and public.current_user_role() = 'Staff')
  with check (recorded_by = auth.uid() and farm_id = public.current_farm_id());

-- ...and can only delete their own entries, and only when their farm's own
-- Farm Admin has explicitly allowed it via farms.staff_can_delete_inventory.
drop policy if exists "Staff can delete their own inventory events if permitted" on public.poultry_inventory_events;
create policy "Staff can delete their own inventory events if permitted"
  on public.poultry_inventory_events for delete
  using (
    recorded_by = auth.uid()
    and public.current_user_role() = 'Staff'
    and exists (
      select 1 from public.farms
      where id = poultry_inventory_events.farm_id and staff_can_delete_inventory = true
    )
  );

create index if not exists poultry_inventory_events_farm_id_idx on public.poultry_inventory_events (farm_id);
create index if not exists poultry_inventory_events_event_date_idx on public.poultry_inventory_events (event_date);
create index if not exists poultry_inventory_events_bird_type_idx on public.poultry_inventory_events (bird_type);

-- ── Notifications ────────────────────────────────────────────────────────
-- Generic per-recipient inbox: one row per (recipient, event), fanned out at
-- generation time — the standard inbox pattern, and it keeps read/archived
-- state naturally per-user with a single RLS rule (recipient_id = auth.uid()).
-- `category` is a checked text column, not a Postgres enum: this list is
-- expected to grow, and enum ALTER TYPE ADD VALUE has transaction
-- restrictions none of this project's other (small, stable) enums need to
-- deal with.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  farm_id uuid references public.farms (id) on delete cascade,
  category text not null check (category in (
    'low_feed_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
    'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
    'expiring_medicine', 'low_egg_production', 'new_staff_account',
    'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment'
  )),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  link text,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz
);

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (recipient_id = auth.uid());

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Staff can view/mark-as-read but never archive or delete — enforced here,
-- not just hidden in the UI, so it can't be bypassed by calling the API
-- directly. Everyone else (Super Admin/Farm Admin/Manager) can delete.
drop policy if exists "Recipient can delete their own notifications unless Staff" on public.notifications;
create policy "Recipient can delete their own notifications unless Staff"
  on public.notifications for delete
  using (recipient_id = auth.uid() and public.current_user_role() in ('Super Admin', 'Farm Admin', 'Manager'));

-- Manual sends: a Farm Admin/Manager can notify a specific staff member on
-- their own farm (e.g. a task assignment or a reminder) — real, human
-- authored content, not a fabricated automated source. System-generated
-- notifications (below) are inserted by security definer trigger functions,
-- which bypass this policy the same way is_super_admin()/current_farm_id()
-- already bypass profiles' RLS.
drop policy if exists "Farm Admin or Manager can notify their farm's staff" on public.notifications;
create policy "Farm Admin or Manager can notify their farm's staff"
  on public.notifications for insert
  with check (
    public.current_user_role() in ('Farm Admin', 'Manager')
    and farm_id = public.current_farm_id()
    and exists (
      select 1 from public.profiles p
      where p.id = recipient_id and p.farm_id = public.current_farm_id()
    )
  );

-- Only `status` (and its read_at/archived_at bookkeeping) may change after
-- creation — same shape as prevent_farm_field_overreach(). Staff can move
-- unread -> read but never -> archived.
create or replace function public.enforce_notification_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if new.recipient_id is distinct from old.recipient_id
     or new.farm_id is distinct from old.farm_id
     or new.category is distinct from old.category
     or new.title is distinct from old.title
     or new.message is distinct from old.message then
    raise exception 'Only a notification''s status can be changed';
  end if;

  if new.status = 'archived' and public.current_user_role() = 'Staff' then
    raise exception 'Staff cannot archive notifications';
  end if;

  if new.status = 'read' and old.status = 'unread' and new.read_at is null then
    new.read_at := now();
  end if;
  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_notification_status_only on public.notifications;
create trigger enforce_notification_status_only
  before update on public.notifications
  for each row execute procedure public.enforce_notification_update();

create index if not exists notifications_recipient_id_idx on public.notifications (recipient_id);
create index if not exists notifications_farm_id_idx on public.notifications (farm_id);
create index if not exists notifications_status_idx on public.notifications (status);
create index if not exists notifications_category_idx on public.notifications (category);
create index if not exists notifications_created_at_idx on public.notifications (created_at);

-- ── Automatic notifications ─────────────────────────────────────────────
-- Real triggers only where real data already exists — no fabricated feed
-- stock, backup jobs, or login-audit plumbing this app doesn't have. Every
-- function below is security definer so it can insert rows for recipients
-- other than the caller, bypassing the RLS insert policy above the same way
-- is_super_admin() already bypasses profiles' RLS.

-- New User Registration (Super Admin): every new profile row, fan out to
-- every other Super Admin (excludes the row's own id — relevant for the
-- very first signup, which bootstraps itself into Super Admin and would
-- otherwise notify itself about its own registration).
create or replace function public.notify_new_user_registration()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not coalesce((select enabled from public.notification_settings where category = 'new_user_registration'), true) then
    return new;
  end if;

  insert into public.notifications (recipient_id, category, severity, title, message, link)
  select id, 'new_user_registration', 'info', 'New user registered',
         new.name || ' (' || new.role || ') just signed up.',
         '/dashboard/users'
  from public.profiles
  where role = 'Super Admin' and id <> new.id;
  return new;
end;
$$;

drop trigger if exists on_profile_created_notify on public.profiles;
create trigger on_profile_created_notify
  after insert on public.profiles
  for each row execute procedure public.notify_new_user_registration();

-- New Staff Account (Farm Admin/Manager): fires when a Staff row's farm_id
-- transitions into a farm — covers both createStaffAccount's follow-up
-- UPDATE and claimStaff, since neither sets farm_id at insert time.
create or replace function public.notify_new_staff_account()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role = 'Staff' and new.farm_id is not null and new.farm_id is distinct from old.farm_id
     and coalesce((select enabled from public.notification_settings where category = 'new_staff_account'), true) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'new_staff_account', 'info', 'New staff account',
           new.name || ' was added to your farm.',
           '/farm/staff'
    from public.profiles
    where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_updated_notify_staff on public.profiles;
create trigger on_profile_updated_notify_staff
  after update on public.profiles
  for each row execute procedure public.notify_new_staff_account();

-- Mortality Alerts (Super Admin) / High Mortality (Farm Admin/Manager) and
-- Low Inventory (Super Admin): same 5%-of-stock-in-7-days heuristic already
-- implemented client-side in poultryInventoryService.ts's mortalityAlerts(),
-- reimplemented in SQL here. Dedupes per farm/category/day so a busy day of
-- qualifying events produces one alert, not a flood.
create or replace function public.notify_inventory_alerts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_name text;
  v_stock int;
  v_bird_type_stock int;
  v_mortality_7d int;
begin
  select name into v_farm_name from public.farms where id = new.farm_id;

  -- Total stock across every bird type — used for the mortality percentage,
  -- same denominator as the client-side mortalityAlerts() heuristic.
  select coalesce(sum(quantity), 0) into v_stock
  from public.poultry_inventory_events
  where farm_id = new.farm_id and event_type <> 'transfer';

  -- Stock for just the bird type this event touched — Low Inventory is a
  -- per-bird-type alert ("Layers are down to 8"), not a whole-flock total.
  select coalesce(sum(quantity), 0) into v_bird_type_stock
  from public.poultry_inventory_events
  where farm_id = new.farm_id and event_type <> 'transfer' and bird_type = new.bird_type;

  if new.event_type = 'mortality' then
    select coalesce(sum(quantity), 0) into v_mortality_7d
    from public.poultry_inventory_events
    where farm_id = new.farm_id
      and event_type = 'mortality'
      and event_date >= (current_date - interval '7 days');

    if v_stock > 0 and v_mortality_7d > (0.05 * v_stock)
       and coalesce((select enabled from public.notification_settings where category = 'mortality_alert'), true)
       and not exists (
      select 1 from public.notifications
      where farm_id = new.farm_id and category = 'mortality_alert' and created_at >= date_trunc('day', now())
    ) then
      insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
      select id, new.farm_id, 'mortality_alert', 'critical', 'Mortality Alert',
             v_farm_name || ' has lost ' || v_mortality_7d || ' birds in the last 7 days (over 5% of its stock).',
             '/dashboard/production/inventory'
      from public.profiles where role = 'Super Admin';

      insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
      select id, new.farm_id, 'mortality_alert', 'critical', 'High Mortality Alert',
             'Your farm has lost ' || v_mortality_7d || ' birds in the last 7 days (over 5% of your stock).',
             '/farm/inventory'
      from public.profiles where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
    end if;
  end if;

  if new.event_type in ('mortality', 'sale', 'count_update') and v_bird_type_stock <= 10
     and coalesce((select enabled from public.notification_settings where category = 'low_inventory'), true)
     and not exists (
    select 1 from public.notifications
    where farm_id = new.farm_id and category = 'low_inventory' and created_at >= date_trunc('day', now())
  ) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'low_inventory', 'warning', 'Low Inventory',
           v_farm_name || '''s ' || new.bird_type || ' stock is down to ' || v_bird_type_stock || '.',
           '/dashboard/production/inventory'
    from public.profiles where role = 'Super Admin';
  end if;

  return new;
end;
$$;

drop trigger if exists on_inventory_event_notify on public.poultry_inventory_events;
create trigger on_inventory_event_notify
  after insert on public.poultry_inventory_events
  for each row execute procedure public.notify_inventory_alerts();

-- Low Egg Production (Farm Admin/Manager): fires when a record transitions
-- into 'approved'; compares that day's farm total against its trailing
-- 7-day approved average (needs at least 3 prior days of history to be a
-- meaningful comparison) and flags a drop below 70% of that average.
create or replace function public.notify_low_egg_production()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_name text;
  v_today_total int;
  v_avg_7d numeric;
  v_days_with_data int;
begin
  if new.status <> 'approved' or old.status = new.status then
    return new;
  end if;

  select name into v_farm_name from public.farms where id = new.farm_id;

  select coalesce(sum(eggs_collected), 0) into v_today_total
  from public.egg_production
  where farm_id = new.farm_id and production_date = new.production_date and status = 'approved';

  select coalesce(avg(daily_total), 0), count(*) into v_avg_7d, v_days_with_data
  from (
    select production_date, sum(eggs_collected) as daily_total
    from public.egg_production
    where farm_id = new.farm_id
      and status = 'approved'
      and production_date >= (new.production_date - interval '7 days')
      and production_date < new.production_date
    group by production_date
  ) recent;

  if v_days_with_data >= 3 and v_avg_7d > 0 and v_today_total < (0.7 * v_avg_7d)
     and coalesce((select enabled from public.notification_settings where category = 'low_egg_production'), true)
     and not exists (
    select 1 from public.notifications
    where farm_id = new.farm_id and category = 'low_egg_production' and created_at >= date_trunc('day', now())
  ) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'low_egg_production', 'warning', 'Low Egg Production',
           v_farm_name || ' collected ' || v_today_total || ' eggs on ' || new.production_date ||
             ', well below its recent daily average.',
           '/farm/egg-production'
    from public.profiles where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;

  return new;
end;
$$;

drop trigger if exists on_egg_production_notify on public.egg_production;
create trigger on_egg_production_notify
  after update on public.egg_production
  for each row execute procedure public.notify_low_egg_production();

-- ── Feeds & Vitamins ─────────────────────────────────────────────────────
-- Unlike Poultry Inventory (a pure event log, stock always derived), feeds
-- and vitamins are lot/batch-tracked: each row is one purchased batch
-- (batch_number, supplier, purchase_date all describe *that* batch), so
-- `remaining_stock` is a real, stored, mutable column on the batch itself —
-- not summed at read time. `quantity` is the original purchased amount and
-- never changes; `remaining_stock` only moves via approved distribution/
-- administration records (see the delta triggers below) or a direct Farm
-- Admin correction.

create table if not exists public.feeds (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  feed_name text not null,
  category text,
  brand text,
  batch_number text,
  supplier text,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  remaining_stock numeric not null check (remaining_stock >= 0),
  minimum_stock_level numeric not null default 0 check (minimum_stock_level >= 0),
  purchase_date date not null,
  expiration_date date,
  storage_location text,
  remarks text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vitamins (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  vitamin_name text not null,
  category text,
  brand text,
  batch_number text,
  supplier text,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  remaining_stock numeric not null check (remaining_stock >= 0),
  minimum_stock_level numeric not null default 0 check (minimum_stock_level >= 0),
  purchase_date date not null,
  expiration_date date not null,
  storage_location text,
  remarks text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_feeds_updated_at on public.feeds;
create trigger set_feeds_updated_at
  before update on public.feeds
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_vitamins_updated_at on public.vitamins;
create trigger set_vitamins_updated_at
  before update on public.vitamins
  for each row execute procedure public.handle_updated_at();

alter table public.feeds enable row level security;
alter table public.vitamins enable row level security;

drop policy if exists "Super Admin can view all feeds" on public.feeds;
create policy "Super Admin can view all feeds"
  on public.feeds for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's feeds" on public.feeds;
create policy "Farm Admin or Manager can manage their farm's feeds"
  on public.feeds for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

-- Staff can see their farm's batches (to pick one when recording a
-- distribution) but has no write rights here at all — inventory quantities
-- can only change through an approved distribution/administration record.
drop policy if exists "Staff can view their farm's feeds" on public.feeds;
create policy "Staff can view their farm's feeds"
  on public.feeds for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

drop policy if exists "Super Admin can view all vitamins" on public.vitamins;
create policy "Super Admin can view all vitamins"
  on public.vitamins for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's vitamins" on public.vitamins;
create policy "Farm Admin or Manager can manage their farm's vitamins"
  on public.vitamins for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Staff can view their farm's vitamins" on public.vitamins;
create policy "Staff can view their farm's vitamins"
  on public.vitamins for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

create index if not exists feeds_farm_id_idx on public.feeds (farm_id);
create index if not exists feeds_remaining_stock_idx on public.feeds (remaining_stock);
create index if not exists vitamins_farm_id_idx on public.vitamins (farm_id);
create index if not exists vitamins_remaining_stock_idx on public.vitamins (remaining_stock);
create index if not exists vitamins_expiration_date_idx on public.vitamins (expiration_date);

-- ── Staff -> Farm Admin approval workflow (feed distribution / vitamin
-- administration) — identical shape to egg_production's: Staff records
-- (status starts 'pending'), Farm Admin/Manager approve/reject/correct,
-- Super Admin is read-only. Reuses the existing production_status enum
-- rather than defining a duplicate pending/approved/rejected type.

create table if not exists public.feed_distribution (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  -- restrict, not cascade: deleting a batch that's already been distributed
  -- from would silently erase part of the audit trail.
  feed_id uuid not null references public.feeds (id) on delete restrict,
  house_pen text not null,
  quantity_used numeric not null check (quantity_used > 0),
  unit text not null,
  number_of_chickens int not null check (number_of_chickens > 0),
  distribution_date date not null default current_date,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  status public.production_status not null default 'pending',
  review_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vitamin_administration (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  vitamin_id uuid not null references public.vitamins (id) on delete restrict,
  house_pen text not null,
  dosage text,
  quantity_used numeric not null check (quantity_used > 0),
  unit text not null,
  administration_date date not null default current_date,
  purpose text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  status public.production_status not null default 'pending',
  review_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_feed_distribution_updated_at on public.feed_distribution;
create trigger set_feed_distribution_updated_at
  before update on public.feed_distribution
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_vitamin_administration_updated_at on public.vitamin_administration;
create trigger set_vitamin_administration_updated_at
  before update on public.vitamin_administration
  for each row execute procedure public.handle_updated_at();

alter table public.feed_distribution enable row level security;
alter table public.vitamin_administration enable row level security;

drop policy if exists "Super Admin can view all feed distribution" on public.feed_distribution;
create policy "Super Admin can view all feed distribution"
  on public.feed_distribution for select
  using (public.is_super_admin());

drop policy if exists "Staff can record feed distribution for their farm" on public.feed_distribution;
create policy "Staff can record feed distribution for their farm"
  on public.feed_distribution for insert
  with check (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

drop policy if exists "Staff can view their farm's feed distribution" on public.feed_distribution;
create policy "Staff can view their farm's feed distribution"
  on public.feed_distribution for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

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
  );

drop policy if exists "Farm Admin or Manager can view their farm's feed distribution" on public.feed_distribution;
create policy "Farm Admin or Manager can view their farm's feed distribution"
  on public.feed_distribution for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Farm Admin or Manager can review their farm's feed distribution" on public.feed_distribution;
create policy "Farm Admin or Manager can review their farm's feed distribution"
  on public.feed_distribution for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Super Admin can view all vitamin administration" on public.vitamin_administration;
create policy "Super Admin can view all vitamin administration"
  on public.vitamin_administration for select
  using (public.is_super_admin());

drop policy if exists "Staff can record vitamin administration for their farm" on public.vitamin_administration;
create policy "Staff can record vitamin administration for their farm"
  on public.vitamin_administration for insert
  with check (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

drop policy if exists "Staff can view their farm's vitamin administration" on public.vitamin_administration;
create policy "Staff can view their farm's vitamin administration"
  on public.vitamin_administration for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

drop policy if exists "Staff can edit their own pending or rejected vitamin administration" on public.vitamin_administration;
create policy "Staff can edit their own pending or rejected vitamin administration"
  on public.vitamin_administration for update
  using (
    recorded_by = auth.uid()
    and status in ('pending', 'rejected')
    and public.current_user_role() = 'Staff'
  )
  with check (
    recorded_by = auth.uid()
    and farm_id = public.current_farm_id()
    and status in ('pending', 'rejected')
  );

drop policy if exists "Farm Admin or Manager can view their farm's vitamin administration" on public.vitamin_administration;
create policy "Farm Admin or Manager can view their farm's vitamin administration"
  on public.vitamin_administration for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Farm Admin or Manager can review their farm's vitamin administration" on public.vitamin_administration;
create policy "Farm Admin or Manager can review their farm's vitamin administration"
  on public.vitamin_administration for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

create index if not exists feed_distribution_farm_id_idx on public.feed_distribution (farm_id);
create index if not exists feed_distribution_status_idx on public.feed_distribution (status);
create index if not exists feed_distribution_feed_id_idx on public.feed_distribution (feed_id);
create index if not exists feed_distribution_date_idx on public.feed_distribution (distribution_date);
create index if not exists vitamin_administration_farm_id_idx on public.vitamin_administration (farm_id);
create index if not exists vitamin_administration_status_idx on public.vitamin_administration (status);
create index if not exists vitamin_administration_vitamin_id_idx on public.vitamin_administration (vitamin_id);
create index if not exists vitamin_administration_date_idx on public.vitamin_administration (administration_date);

-- Deduction only ever happens through these two triggers, never a direct
-- client-side stock write — delta-aware so a Farm Admin correcting an
-- already-approved record's quantity_used adjusts stock by just the
-- difference instead of double-counting, and un-approving a record restores
-- what it had taken. Blocks the underlying feed/vitamin batch from being
-- changed post-creation (a correction fixes the quantity, not which batch
-- the record was ever against).
create or replace function public.apply_feed_stock_delta()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_remaining numeric;
  v_delta numeric;
begin
  if new.feed_id is distinct from old.feed_id or new.farm_id is distinct from old.farm_id then
    raise exception 'Cannot change which feed batch or farm a distribution record belongs to';
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    select remaining_stock into v_remaining from public.feeds where id = new.feed_id for update;
    if v_remaining < new.quantity_used then
      raise exception 'Not enough feed stock remaining (% available, % requested)', v_remaining, new.quantity_used;
    end if;
    update public.feeds set remaining_stock = remaining_stock - new.quantity_used where id = new.feed_id;

  elsif new.status = 'approved' and old.status = 'approved' and new.quantity_used is distinct from old.quantity_used then
    v_delta := new.quantity_used - old.quantity_used;
    if v_delta > 0 then
      select remaining_stock into v_remaining from public.feeds where id = new.feed_id for update;
      if v_remaining < v_delta then
        raise exception 'Not enough feed stock remaining to increase usage (% available, % more requested)', v_remaining, v_delta;
      end if;
    end if;
    update public.feeds set remaining_stock = remaining_stock - v_delta where id = new.feed_id;

  elsif old.status = 'approved' and new.status <> 'approved' then
    update public.feeds set remaining_stock = remaining_stock + old.quantity_used where id = new.feed_id;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_feed_stock_delta_trigger on public.feed_distribution;
create trigger apply_feed_stock_delta_trigger
  after update on public.feed_distribution
  for each row execute procedure public.apply_feed_stock_delta();

create or replace function public.apply_vitamin_stock_delta()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_remaining numeric;
  v_delta numeric;
begin
  if new.vitamin_id is distinct from old.vitamin_id or new.farm_id is distinct from old.farm_id then
    raise exception 'Cannot change which vitamin batch or farm an administration record belongs to';
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    select remaining_stock into v_remaining from public.vitamins where id = new.vitamin_id for update;
    if v_remaining < new.quantity_used then
      raise exception 'Not enough vitamin stock remaining (% available, % requested)', v_remaining, new.quantity_used;
    end if;
    update public.vitamins set remaining_stock = remaining_stock - new.quantity_used where id = new.vitamin_id;

  elsif new.status = 'approved' and old.status = 'approved' and new.quantity_used is distinct from old.quantity_used then
    v_delta := new.quantity_used - old.quantity_used;
    if v_delta > 0 then
      select remaining_stock into v_remaining from public.vitamins where id = new.vitamin_id for update;
      if v_remaining < v_delta then
        raise exception 'Not enough vitamin stock remaining to increase usage (% available, % more requested)', v_remaining, v_delta;
      end if;
    end if;
    update public.vitamins set remaining_stock = remaining_stock - v_delta where id = new.vitamin_id;

  elsif old.status = 'approved' and new.status <> 'approved' then
    update public.vitamins set remaining_stock = remaining_stock + old.quantity_used where id = new.vitamin_id;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_vitamin_stock_delta_trigger on public.vitamin_administration;
create trigger apply_vitamin_stock_delta_trigger
  after update on public.vitamin_administration
  for each row execute procedure public.apply_vitamin_stock_delta();

-- ── Feeds & Vitamins alerts ──────────────────────────────────────────────
-- Reuses the Notifications module built earlier: low_feed_stock and
-- expiring_medicine already existed as valid-but-dormant categories
-- (added when Notifications shipped, before this module existed to
-- generate them for real). low_vitamin_stock is the one new category.
alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in (
  'low_feed_stock', 'low_vitamin_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
  'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
  'expiring_medicine', 'low_egg_production', 'new_staff_account',
  'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment'
));

create or replace function public.notify_feed_alerts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_name text;
begin
  if new.remaining_stock > new.minimum_stock_level then
    return new;
  end if;

  select name into v_farm_name from public.farms where id = new.farm_id;

  if coalesce((select enabled from public.notification_settings where category = 'low_feed_stock'), true)
     and not exists (
    select 1 from public.notifications
    where farm_id = new.farm_id and category = 'low_feed_stock' and created_at >= date_trunc('day', now())
  ) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'low_feed_stock', 'warning', 'Low Feed Stock',
           v_farm_name || '''s ' || new.feed_name || ' stock is down to ' || new.remaining_stock || ' ' || new.unit || '.',
           '/farm/feed'
    from public.profiles where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');

    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'low_feed_stock', 'warning', 'Low Feed Stock',
           v_farm_name || '''s ' || new.feed_name || ' stock is down to ' || new.remaining_stock || ' ' || new.unit || '.',
           '/dashboard/production/feed'
    from public.profiles where role = 'Super Admin';
  end if;

  return new;
end;
$$;

drop trigger if exists on_feed_notify on public.feeds;
create trigger on_feed_notify
  after insert or update on public.feeds
  for each row execute procedure public.notify_feed_alerts();

-- Vitamins get two independent checks: low stock (same shape as feed) and
-- expiration proximity (<=30 days, or already past). This only re-evaluates
-- on insert/update of the row itself — it won't catch a batch that was fine
-- when added and silently crosses the threshold while nobody touches it.
-- expiringVitamins() on the client (feedVitaminService.ts) is what actually
-- guarantees a correct "expiring soon" list on every page load regardless
-- of when that happens; this trigger's Notification-inbox entry is a bonus
-- for the common cases (a new batch already close to expiry, or a
-- correction to one), not the source of truth.
create or replace function public.notify_vitamin_alerts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_name text;
  v_days_to_expiry int;
begin
  select name into v_farm_name from public.farms where id = new.farm_id;

  if new.remaining_stock <= new.minimum_stock_level
     and coalesce((select enabled from public.notification_settings where category = 'low_vitamin_stock'), true)
     and not exists (
    select 1 from public.notifications
    where farm_id = new.farm_id and category = 'low_vitamin_stock' and created_at >= date_trunc('day', now())
  ) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'low_vitamin_stock', 'warning', 'Low Vitamin Stock',
           v_farm_name || '''s ' || new.vitamin_name || ' stock is down to ' || new.remaining_stock || ' ' || new.unit || '.',
           '/farm/vitamins'
    from public.profiles where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');

    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'low_vitamin_stock', 'warning', 'Low Vitamin Stock',
           v_farm_name || '''s ' || new.vitamin_name || ' stock is down to ' || new.remaining_stock || ' ' || new.unit || '.',
           '/dashboard/production/feed'
    from public.profiles where role = 'Super Admin';
  end if;

  v_days_to_expiry := new.expiration_date - current_date;
  if v_days_to_expiry <= 30
     and coalesce((select enabled from public.notification_settings where category = 'expiring_medicine'), true)
     and not exists (
    select 1 from public.notifications
    where farm_id = new.farm_id and category = 'expiring_medicine' and created_at >= date_trunc('day', now())
  ) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'expiring_medicine',
           case when v_days_to_expiry < 0 then 'critical' else 'warning' end,
           case when v_days_to_expiry < 0 then 'Vitamin Expired' else 'Vitamin Expiring Soon' end,
           new.vitamin_name || ' (' || v_farm_name || ') ' ||
             case when v_days_to_expiry < 0 then 'expired on ' || new.expiration_date || '.'
                  else 'expires on ' || new.expiration_date || '.' end,
           '/farm/vitamins'
    from public.profiles where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');

    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'expiring_medicine',
           case when v_days_to_expiry < 0 then 'critical' else 'warning' end,
           case when v_days_to_expiry < 0 then 'Vitamin Expired' else 'Vitamin Expiring Soon' end,
           new.vitamin_name || ' (' || v_farm_name || ') ' ||
             case when v_days_to_expiry < 0 then 'expired on ' || new.expiration_date || '.'
                  else 'expires on ' || new.expiration_date || '.' end,
           '/dashboard/production/feed'
    from public.profiles where role = 'Super Admin';
  end if;

  return new;
end;
$$;

drop trigger if exists on_vitamin_notify on public.vitamins;
create trigger on_vitamin_notify
  after insert or update on public.vitamins
  for each row execute procedure public.notify_vitamin_alerts();

-- ── Security Management ─────────────────────────────────────────────────
-- Reaches into the actual auth path, not a CRUD domain. Password-policy and
-- lockout enforcement below only cover what this app's own login/sign-up
-- forms do — Supabase Auth's own server-side password floor and rate
-- limiting (configured in the Supabase Dashboard) still apply underneath,
-- independently of this.

create table if not exists public.security_settings (
  id boolean primary key default true check (id),
  min_password_length int not null default 8 check (min_password_length >= 6),
  require_uppercase boolean not null default true,
  require_lowercase boolean not null default true,
  require_number boolean not null default true,
  require_symbol boolean not null default false,
  mfa_enabled boolean not null default false,
  session_timeout_minutes int not null default 60 check (session_timeout_minutes >= 5),
  max_failed_attempts int not null default 10 check (max_failed_attempts >= 3),
  lockout_duration_minutes int not null default 15 check (lockout_duration_minutes >= 1),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.security_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists set_security_settings_updated_at on public.security_settings;
create trigger set_security_settings_updated_at
  before update on public.security_settings
  for each row execute procedure public.handle_updated_at();

alter table public.security_settings enable row level security;

-- World-readable: these are just policy thresholds (not sensitive), and the
-- sign-up form and the pre-auth lockout check both need them before anyone
-- has a session.
drop policy if exists "Anyone can view security settings" on public.security_settings;
create policy "Anyone can view security settings"
  on public.security_settings for select
  using (true);

drop policy if exists "Super Admin can update security settings" on public.security_settings;
create policy "Super Admin can update security settings"
  on public.security_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── Login history ────────────────────────────────────────────────────────
-- One row per real sign-in this app observes (AuthContext inserts on
-- SIGNED_IN only, never on token refresh) — only sees logins that happened
-- through this app's own login form/OAuth flow, not any other client
-- hitting the Supabase project directly.

create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.login_history enable row level security;

drop policy if exists "Users can view their own login history" on public.login_history;
create policy "Users can view their own login history"
  on public.login_history for select
  using (user_id = auth.uid() or public.is_super_admin());

-- No update/delete policy at all — an audit log stays immutable by
-- construction, not by convention.
drop policy if exists "Users can record their own login" on public.login_history;
create policy "Users can record their own login"
  on public.login_history for insert
  with check (user_id = auth.uid());

create index if not exists login_history_user_id_idx on public.login_history (user_id);
create index if not exists login_history_created_at_idx on public.login_history (created_at);

-- ── Failed login attempts & lockout ─────────────────────────────────────
-- A failed sign-in has no session, so there's no auth.uid() to attach a log
-- row to — the only way to capture it at all is to let the login form
-- itself report the failure, which means the write must be reachable by an
-- unauthenticated (anon) caller. RLS is enabled with zero direct policies —
-- every access goes through the two security definer functions below (same
-- bypass reasoning as is_super_admin() etc.), so the actual writable/
-- readable surface is exactly those two narrow operations, never an open
-- table policy anyone could query or spam freely.
create table if not exists public.failed_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.failed_login_attempts enable row level security;

create index if not exists failed_login_attempts_email_idx on public.failed_login_attempts (email);
create index if not exists failed_login_attempts_created_at_idx on public.failed_login_attempts (created_at);

drop policy if exists "Super Admin can view failed login attempts" on public.failed_login_attempts;
create policy "Super Admin can view failed login attempts"
  on public.failed_login_attempts for select
  using (public.is_super_admin());

create or replace function public.record_failed_login_attempt(p_email text, p_user_agent text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_max_attempts int;
  v_recent_count int;
begin
  insert into public.failed_login_attempts (email, user_agent)
  values (lower(trim(p_email)), p_user_agent);

  -- No authenticated user exists yet at this point, so user_id/farm_id stay
  -- null — the attempted email is the only identifying context available,
  -- carried in the description instead.
  insert into public.audit_logs (module, action, description, severity, status, browser)
  values ('Authentication', 'failed_login', 'Failed sign-in attempt for ' || lower(trim(p_email)), 'warning', 'failure', p_user_agent);

  -- Reuses the exact threshold that already governs account lockout —
  -- "Multiple Failed Login Attempts" isn't a separately-invented number.
  select max_failed_attempts into v_max_attempts from public.security_settings where id = true;
  select count(*) into v_recent_count
  from public.failed_login_attempts
  where email = lower(trim(p_email)) and created_at >= now() - interval '1 hour';

  if v_recent_count >= v_max_attempts then
    insert into public.audit_logs (module, action, description, severity, status)
    values (
      'Authentication', 'multiple_failed_logins',
      'Multiple failed sign-in attempts for ' || lower(trim(p_email)) || ' — account temporarily locked.',
      'critical', 'failure'
    );
  end if;
end;
$$;

grant execute on function public.record_failed_login_attempt(text, text) to anon, authenticated;

-- Known, inherent trade-off (shared by basically every email-based lockout
-- scheme): since the anon key is public, anyone can call
-- record_failed_login_attempt for *any* email string, real or not — which
-- is exactly why max_failed_attempts/lockout_duration_minutes above default
-- to lenient values, not hair-trigger ones.
create or replace function public.check_login_allowed(p_email text)
returns table (allowed boolean, retry_after_seconds int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_max_attempts int;
  v_lockout_minutes int;
  v_recent_count int;
  v_oldest timestamptz;
begin
  select max_failed_attempts, lockout_duration_minutes
    into v_max_attempts, v_lockout_minutes
  from public.security_settings where id = true;

  select count(*), min(created_at) into v_recent_count, v_oldest
  from public.failed_login_attempts
  where email = lower(trim(p_email))
    and created_at >= now() - make_interval(mins => v_lockout_minutes);

  if v_recent_count >= v_max_attempts then
    return query select false, greatest(0, extract(epoch from (v_oldest + make_interval(mins => v_lockout_minutes) - now()))::int);
  else
    return query select true, 0;
  end if;
end;
$$;

grant execute on function public.check_login_allowed(text) to anon, authenticated;

-- ── System Settings ──────────────────────────────────────────────────────
create table if not exists public.system_settings (
  id boolean primary key default true check (id),
  system_name text not null default 'PoultryHub',
  logo_url text,
  default_theme text not null default 'system' check (default_theme in ('light', 'dark', 'system')),
  language text not null default 'en-US',
  timezone text not null default 'Asia/Manila',
  date_format text not null default 'MM/DD/YYYY',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at
  before update on public.system_settings
  for each row execute procedure public.handle_updated_at();

alter table public.system_settings enable row level security;

-- World-readable: the login screen needs the system name/logo before
-- anyone has a session, same reasoning as security_settings.
drop policy if exists "Anyone can view system settings" on public.system_settings;
create policy "Anyone can view system settings"
  on public.system_settings for select
  using (true);

drop policy if exists "Super Admin can update system settings" on public.system_settings;
create policy "Super Admin can update system settings"
  on public.system_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── System assets storage (logo upload) ─────────────────────────────────
-- A Storage bucket is just a row in storage.buckets, and access control is
-- plain RLS on storage.objects — both provisionable right here, no
-- Supabase Dashboard access needed. File type/size limits are enforced
-- client-side (systemSettingsService.ts) rather than via bucket-level
-- file_size_limit/allowed_mime_types columns, since those columns' exact
-- availability varies by Supabase/Storage version and a mismatch there
-- would break this entire script running end to end.
insert into storage.buckets (id, name, public)
values ('system-assets', 'system-assets', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view system assets" on storage.objects;
create policy "Anyone can view system assets"
  on storage.objects for select
  using (bucket_id = 'system-assets');

drop policy if exists "Super Admin can upload system assets" on storage.objects;
create policy "Super Admin can upload system assets"
  on storage.objects for insert
  with check (bucket_id = 'system-assets' and public.is_super_admin());

drop policy if exists "Super Admin can update system assets" on storage.objects;
create policy "Super Admin can update system assets"
  on storage.objects for update
  using (bucket_id = 'system-assets' and public.is_super_admin());

drop policy if exists "Super Admin can delete system assets" on storage.objects;
create policy "Super Admin can delete system assets"
  on storage.objects for delete
  using (bucket_id = 'system-assets' and public.is_super_admin());

-- ── Email Configuration (SMTP / Notifications / Templates) ──────────────
-- SMTP: reference/documentation only, deliberately no password column.
-- A browser app can never safely hold SMTP credentials — there's no backend
-- here to execute delivery. Real transport is configured directly in the
-- Supabase Dashboard (Authentication -> Emails -> SMTP Settings); this table
-- just records the operational details for the team, editable by Super Admin.
create table if not exists public.smtp_settings (
  id boolean primary key default true check (id),
  host text,
  port integer,
  username text,
  from_name text not null default 'PoultryHub',
  from_email text,
  reply_to text,
  encryption text not null default 'tls' check (encryption in ('none', 'ssl', 'tls')),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.smtp_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists set_smtp_settings_updated_at on public.smtp_settings;
create trigger set_smtp_settings_updated_at
  before update on public.smtp_settings
  for each row execute procedure public.handle_updated_at();

alter table public.smtp_settings enable row level security;

drop policy if exists "Super Admin can view smtp settings" on public.smtp_settings;
create policy "Super Admin can view smtp settings"
  on public.smtp_settings for select
  using (public.is_super_admin());

drop policy if exists "Super Admin can update smtp settings" on public.smtp_settings;
create policy "Super Admin can update smtp settings"
  on public.smtp_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Notification event toggles: one row per category that already has a real
-- trigger generating it (see notify_* functions above). Each of those
-- functions checks its own category's flag here before inserting — an
-- additive guard, no other trigger logic changes. The 4 categories with no
-- trigger yet (system_update/security_alert/backup_completion/
-- failed_login_attempt) aren't included — a toggle for something nothing
-- generates would be fake.
create table if not exists public.notification_settings (
  category text primary key check (category in (
    'new_user_registration', 'new_staff_account', 'mortality_alert', 'low_inventory',
    'low_egg_production', 'low_feed_stock', 'low_vitamin_stock', 'expiring_medicine'
  )),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.notification_settings (category) values
  ('new_user_registration'), ('new_staff_account'), ('mortality_alert'), ('low_inventory'),
  ('low_egg_production'), ('low_feed_stock'), ('low_vitamin_stock'), ('expiring_medicine')
on conflict (category) do nothing;

drop trigger if exists set_notification_settings_updated_at on public.notification_settings;
create trigger set_notification_settings_updated_at
  before update on public.notification_settings
  for each row execute procedure public.handle_updated_at();

alter table public.notification_settings enable row level security;

drop policy if exists "Super Admin can view notification settings" on public.notification_settings;
create policy "Super Admin can view notification settings"
  on public.notification_settings for select
  using (public.is_super_admin());

drop policy if exists "Super Admin can update notification settings" on public.notification_settings;
create policy "Super Admin can update notification settings"
  on public.notification_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Notification templates: default title/message for the 4 categories a
-- Farm Admin/Manager already composes by hand in SendNotificationDrawer.tsx.
-- Picking the category there pre-fills these — still freely editable before
-- sending, a real default rather than a lock. The 8 system-generated
-- categories keep their wording fixed in the notify_* trigger functions
-- above (shown read-only in the UI) — editing those would mean rewriting
-- already-shipped trigger logic, out of scope here.
create table if not exists public.notification_templates (
  category text primary key check (category in (
    'task_assignment', 'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder'
  )),
  title text not null default '',
  message text not null default '',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.notification_templates (category) values
  ('task_assignment'), ('feed_schedule_reminder'), ('vaccination_reminder'), ('production_reminder')
on conflict (category) do nothing;

drop trigger if exists set_notification_templates_updated_at on public.notification_templates;
create trigger set_notification_templates_updated_at
  before update on public.notification_templates
  for each row execute procedure public.handle_updated_at();

alter table public.notification_templates enable row level security;

drop policy if exists "Farm Admin, Manager, and Super Admin can view notification templates" on public.notification_templates;
create policy "Farm Admin, Manager, and Super Admin can view notification templates"
  on public.notification_templates for select
  using (public.is_super_admin() or public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Super Admin can update notification templates" on public.notification_templates;
create policy "Super Admin can update notification templates"
  on public.notification_templates for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── Health Records & Mortality Records ───────────────────────────────────
-- Same Staff -> Farm Admin approval workflow as feed_distribution/
-- vitamin_administration, reusing the same production_status enum. Farm
-- Admin/Manager additionally get a direct insert path (unlike Feeds &
-- Vitamins) since the spec asks for "complete CRUD" here, not just review —
-- a Farm-Admin-authored record is inserted pre-approved by the client
-- (status: 'approved'), since they already hold review authority. Deliberately
-- independent from poultry_inventory_events' own mortality event type — a
-- different dimension (house/pen vs. bird type), a different purpose
-- (compliance record vs. quick stock log) — no write coupling between them.
create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  house_pen text not null,
  record_date date not null default current_date,
  disease_condition text not null,
  symptoms text,
  affected_birds int not null check (affected_birds > 0),
  medication text,
  treatment text,
  vaccination text,
  veterinarian text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  status public.production_status not null default 'pending',
  review_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mortality_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  house_pen text not null,
  record_date date not null default current_date,
  dead_birds int not null check (dead_birds > 0),
  cause_of_death text not null,
  disposal_method text,
  veterinarian_confirmation text,
  photo_url text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  status public.production_status not null default 'pending',
  review_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_health_records_updated_at on public.health_records;
create trigger set_health_records_updated_at
  before update on public.health_records
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_mortality_records_updated_at on public.mortality_records;
create trigger set_mortality_records_updated_at
  before update on public.mortality_records
  for each row execute procedure public.handle_updated_at();

alter table public.health_records enable row level security;
alter table public.mortality_records enable row level security;

drop policy if exists "Super Admin can view all health records" on public.health_records;
create policy "Super Admin can view all health records"
  on public.health_records for select
  using (public.is_super_admin());

drop policy if exists "Staff can record health observations for their farm" on public.health_records;
create policy "Staff can record health observations for their farm"
  on public.health_records for insert
  with check (
    farm_id = public.current_farm_id()
    and public.current_user_role() = 'Staff'
    and status = 'pending'
  );

drop policy if exists "Staff can view their farm's health records" on public.health_records;
create policy "Staff can view their farm's health records"
  on public.health_records for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

drop policy if exists "Staff can edit their own pending or rejected health records" on public.health_records;
create policy "Staff can edit their own pending or rejected health records"
  on public.health_records for update
  using (
    recorded_by = auth.uid()
    and status in ('pending', 'rejected')
    and public.current_user_role() = 'Staff'
  )
  with check (
    recorded_by = auth.uid()
    and farm_id = public.current_farm_id()
    and status in ('pending', 'rejected')
  );

drop policy if exists "Farm Admin or Manager can view their farm's health records" on public.health_records;
create policy "Farm Admin or Manager can view their farm's health records"
  on public.health_records for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Farm Admin or Manager can record health observations for their farm" on public.health_records;
create policy "Farm Admin or Manager can record health observations for their farm"
  on public.health_records for insert
  with check (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Farm Admin or Manager can manage their farm's health records" on public.health_records;
create policy "Farm Admin or Manager can manage their farm's health records"
  on public.health_records for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Farm Admin or Manager can delete their farm's health records" on public.health_records;
create policy "Farm Admin or Manager can delete their farm's health records"
  on public.health_records for delete
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Super Admin can view all mortality records" on public.mortality_records;
create policy "Super Admin can view all mortality records"
  on public.mortality_records for select
  using (public.is_super_admin());

drop policy if exists "Staff can record mortality for their farm" on public.mortality_records;
create policy "Staff can record mortality for their farm"
  on public.mortality_records for insert
  with check (
    farm_id = public.current_farm_id()
    and public.current_user_role() = 'Staff'
    and status = 'pending'
  );

drop policy if exists "Staff can view their farm's mortality records" on public.mortality_records;
create policy "Staff can view their farm's mortality records"
  on public.mortality_records for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

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
  );

drop policy if exists "Farm Admin or Manager can view their farm's mortality records" on public.mortality_records;
create policy "Farm Admin or Manager can view their farm's mortality records"
  on public.mortality_records for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Farm Admin or Manager can record mortality for their farm" on public.mortality_records;
create policy "Farm Admin or Manager can record mortality for their farm"
  on public.mortality_records for insert
  with check (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Farm Admin or Manager can manage their farm's mortality records" on public.mortality_records;
create policy "Farm Admin or Manager can manage their farm's mortality records"
  on public.mortality_records for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Farm Admin or Manager can delete their farm's mortality records" on public.mortality_records;
create policy "Farm Admin or Manager can delete their farm's mortality records"
  on public.mortality_records for delete
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

create index if not exists health_records_farm_id_idx on public.health_records (farm_id);
create index if not exists health_records_status_idx on public.health_records (status);
create index if not exists health_records_date_idx on public.health_records (record_date);
create index if not exists health_records_disease_idx on public.health_records (disease_condition);
create index if not exists mortality_records_farm_id_idx on public.mortality_records (farm_id);
create index if not exists mortality_records_status_idx on public.mortality_records (status);
create index if not exists mortality_records_date_idx on public.mortality_records (record_date);

-- ── Mortality photo evidence storage ─────────────────────────────────────
-- Private bucket (unlike system-assets) — internal farm records, not
-- branding. Path convention '{farm_id}/{filename}' so RLS can scope by
-- folder prefix; client reads via a short-lived signed URL, never a public
-- one.
insert into storage.buckets (id, name, public)
values ('mortality-photos', 'mortality-photos', false)
on conflict (id) do nothing;

drop policy if exists "Farm members can view their farm's mortality photos" on storage.objects;
create policy "Farm members can view their farm's mortality photos"
  on storage.objects for select
  using (
    bucket_id = 'mortality-photos'
    and (public.is_super_admin() or (storage.foldername(name))[1] = public.current_farm_id()::text)
  );

drop policy if exists "Farm staff can upload their farm's mortality photos" on storage.objects;
create policy "Farm staff can upload their farm's mortality photos"
  on storage.objects for insert
  with check (
    bucket_id = 'mortality-photos'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_user_role() in ('Staff', 'Farm Admin', 'Manager')
  );

drop policy if exists "Farm Admin or Manager can delete their farm's mortality photos" on storage.objects;
create policy "Farm Admin or Manager can delete their farm's mortality photos"
  on storage.objects for delete
  using (
    bucket_id = 'mortality-photos'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_user_role() in ('Farm Admin', 'Manager')
  );

-- ── Audit Log ─────────────────────────────────────────────────────────
-- Generalized from the Health/Mortality-only version this table started as
-- (that table's own comment flagged this exact retrofit as the intended
-- follow-up). Now a real, app-wide, immutable trail: every real mutable
-- table in the app gets an additive audit trigger (existing trigger
-- functions are never modified, only new ones added alongside them), plus a
-- small secure RPC for the handful of real actions with no table mutation to
-- hang a trigger on (login/logout/password change/report export). No
-- insert/update/delete RLS policy exists for any role — the security
-- definer function/RPC below are the only writers, so logs are immutable by
-- construction.
--
-- Idempotent rename guards: this table already existed and had rows under
-- the old narrower column names, so renames (unlike every other change in
-- this file) aren't naturally idempotent — each is guarded to only fire once.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'entity_type') then
    alter table public.audit_logs rename column entity_type to table_name;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'entity_id') then
    alter table public.audit_logs rename column entity_id to record_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'actor_id') then
    alter table public.audit_logs rename column actor_id to user_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'actor_name') then
    alter table public.audit_logs rename column actor_name to user_name;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'summary') then
    alter table public.audit_logs rename column summary to description;
  end if;
end $$;

-- table_name/action no longer belong to a small fixed set — the app-wide
-- version grows with every module instrumented, not worth re-constraining.
alter table public.audit_logs drop constraint if exists audit_logs_entity_type_check;
alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs alter column table_name drop not null;
alter table public.audit_logs alter column record_id drop not null;

alter table public.audit_logs add column if not exists module text;
alter table public.audit_logs add column if not exists user_role public.user_role;
alter table public.audit_logs add column if not exists farm_name text;
alter table public.audit_logs add column if not exists old_value jsonb;
alter table public.audit_logs add column if not exists new_value jsonb;
alter table public.audit_logs add column if not exists device text;
alter table public.audit_logs add column if not exists browser text;
alter table public.audit_logs add column if not exists operating_system text;
alter table public.audit_logs add column if not exists severity text;
alter table public.audit_logs add column if not exists status text;

update public.audit_logs set severity = 'info' where severity is null;
update public.audit_logs set status = 'success' where status is null;
update public.audit_logs
  set module = case table_name when 'health_record' then 'Health Records' when 'mortality_record' then 'Mortality Records' else 'System' end
  where module is null;

alter table public.audit_logs alter column module set not null;
alter table public.audit_logs alter column severity set not null;
alter table public.audit_logs alter column severity set default 'info';
alter table public.audit_logs alter column status set not null;
alter table public.audit_logs alter column status set default 'success';

alter table public.audit_logs drop constraint if exists audit_logs_severity_check;
alter table public.audit_logs add constraint audit_logs_severity_check check (severity in ('info', 'warning', 'high', 'critical'));
alter table public.audit_logs drop constraint if exists audit_logs_status_check;
alter table public.audit_logs add constraint audit_logs_status_check check (status in ('success', 'failure'));

alter table public.audit_logs enable row level security;

-- user_name/farm_name/user_role are snapshotted at write time (not
-- live-joined) on purpose — an audit row should show what was true *at the
-- time*, not retroactively reflect a later rename/role change.
drop policy if exists "Super Admin can view audit logs" on public.audit_logs;
drop policy if exists "Super Admin can view all audit logs" on public.audit_logs;
create policy "Super Admin can view all audit logs"
  on public.audit_logs for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can view their farm's audit logs" on public.audit_logs;
create policy "Farm Admin or Manager can view their farm's audit logs"
  on public.audit_logs for select
  using (public.current_user_role() in ('Farm Admin', 'Manager') and farm_id = public.current_farm_id());

drop policy if exists "Staff can view their own audit logs" on public.audit_logs;
create policy "Staff can view their own audit logs"
  on public.audit_logs for select
  using (public.current_user_role() = 'Staff' and user_id = auth.uid());

drop index if exists audit_logs_entity_idx;
create index if not exists audit_logs_table_record_idx on public.audit_logs (table_name, record_id);
create index if not exists audit_logs_farm_id_idx on public.audit_logs (farm_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at);
create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);
create index if not exists audit_logs_module_idx on public.audit_logs (module);
create index if not exists audit_logs_severity_idx on public.audit_logs (severity);

-- One generic function reused by every audited table's insert/update/delete
-- triggers — TG_TABLE_NAME/TG_OP plus an old/new diff derive module, action,
-- and severity per the spec's exact 4-tier taxonomy (info/warning/high/
-- critical). security definer so it can write here regardless of who's
-- making the underlying change, same mechanism the notify_* triggers already
-- use against notifications. Attached purely additively below — no existing
-- trigger function anywhere in this file is modified.
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_row record;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_user_role public.user_role;
  v_farm_id uuid;
  v_farm_name text;
  v_record_id uuid;
  v_module text;
  v_action text;
  v_severity text := 'info';
  v_description text;
begin
  if TG_OP = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  select name, role into v_user_name, v_user_role from public.profiles where id = v_user_id;

  v_module := case TG_TABLE_NAME
    when 'farms' then 'Farm Management'
    when 'profiles' then 'User Management'
    when 'egg_production' then 'Egg Production'
    when 'poultry_inventory_events' then 'Poultry Inventory'
    when 'feeds' then 'Feeds & Vitamins'
    when 'vitamins' then 'Feeds & Vitamins'
    when 'feed_distribution' then 'Feeds & Vitamins'
    when 'vitamin_administration' then 'Feeds & Vitamins'
    when 'health_records' then 'Health Records'
    when 'mortality_records' then 'Mortality Records'
    when 'notifications' then 'Notifications'
    when 'system_settings' then 'System Settings'
    when 'smtp_settings' then 'System Settings'
    when 'notification_settings' then 'System Settings'
    when 'notification_templates' then 'System Settings'
    when 'sales' then 'Sales & Expenses'
    when 'expenses' then 'Sales & Expenses'
    else TG_TABLE_NAME
  end;

  if TG_TABLE_NAME = 'farms' then
    v_farm_id := v_row.id;
    v_farm_name := v_row.name;
  elsif TG_TABLE_NAME in ('system_settings', 'smtp_settings', 'notification_settings', 'notification_templates') then
    v_farm_id := null;
  else
    v_farm_id := v_row.farm_id;
  end if;

  if v_farm_id is not null and v_farm_name is null then
    select name into v_farm_name from public.farms where id = v_farm_id;
  end if;

  -- record_id is only meaningful for uuid-keyed tables — the 4 settings
  -- tables are singleton (boolean id) or category-keyed (text), not uuid.
  if TG_TABLE_NAME in ('system_settings', 'smtp_settings', 'notification_settings', 'notification_templates') then
    v_record_id := null;
  else
    v_record_id := v_row.id;
  end if;

  if TG_OP = 'DELETE' then
    v_action := case TG_TABLE_NAME
      when 'profiles' then 'user_deleted'
      when 'farms' then 'farm_deleted'
      else TG_TABLE_NAME || '_deleted'
    end;
    v_severity := case TG_TABLE_NAME when 'profiles' then 'critical' when 'farms' then 'critical' else 'high' end;
  elsif TG_OP = 'INSERT' then
    if TG_TABLE_NAME = 'farms' then
      v_action := 'farm_registered'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'profiles' then
      v_action := 'user_created'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'notifications' then
      if new.created_by is null then
        -- System-generated notification — already logged via whatever
        -- action triggered it. Only human-composed sends are audited here.
        return new;
      end if;
      v_action := 'notification_sent'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'feeds' then
      v_action := 'feed_stock_added'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'vitamins' then
      v_action := 'vitamin_stock_added'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'sales' then
      v_action := 'sale_recorded'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'expenses' then
      v_action := 'expense_recorded'; v_severity := 'info';
    else
      v_action := TG_TABLE_NAME || '_recorded'; v_severity := 'info';
    end if;
  else -- UPDATE
    if TG_TABLE_NAME = 'profiles' then
      if new.status = 'disabled' and old.status is distinct from 'disabled' then
        v_action := 'user_deactivated'; v_severity := 'high';
      elsif new.status = 'active' and old.status is distinct from 'active' then
        v_action := 'user_activated'; v_severity := 'info';
      elsif new.role is distinct from old.role then
        v_action := 'role_changed'; v_severity := 'high';
      elsif new.farm_id is distinct from old.farm_id and new.farm_id is not null then
        v_action := 'staff_assigned'; v_severity := 'info';
      else
        v_action := 'user_updated'; v_severity := 'info';
      end if;
    elsif TG_TABLE_NAME = 'farms' then
      v_action := 'farm_updated'; v_severity := 'high';
    elsif TG_TABLE_NAME in ('egg_production', 'feed_distribution', 'vitamin_administration', 'health_records', 'mortality_records')
          and new.status is distinct from old.status then
      v_action := new.status::text;
      v_severity := case new.status::text when 'rejected' then 'warning' else 'info' end;
    elsif TG_TABLE_NAME in ('system_settings', 'smtp_settings', 'notification_settings', 'notification_templates') then
      v_action := 'system_settings_updated'; v_severity := 'critical';
    elsif TG_TABLE_NAME = 'feeds' then
      v_action := 'feed_stock_updated'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'vitamins' then
      v_action := 'vitamin_stock_updated'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'sales' then
      v_action := 'sale_updated'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'expenses' then
      v_action := 'expense_updated'; v_severity := 'info';
    else
      v_action := TG_TABLE_NAME || '_updated'; v_severity := 'info';
    end if;
  end if;

  v_description := v_module || ': ' || replace(v_action, '_', ' ');

  insert into public.audit_logs (
    user_id, user_name, user_role, farm_id, farm_name, module, action, description,
    table_name, record_id, old_value, new_value, severity, status
  )
  values (
    v_user_id, v_user_name, v_user_role, v_farm_id, v_farm_name, v_module, v_action, v_description,
    TG_TABLE_NAME, v_record_id,
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end,
    v_severity, 'success'
  );

  return v_row;
end;
$$;

-- Superseded by the generic function above.
drop trigger if exists audit_health_records on public.health_records;
drop trigger if exists audit_mortality_records on public.mortality_records;
drop function if exists public.log_health_mortality_audit();

drop trigger if exists audit_farms on public.farms;
create trigger audit_farms after insert or update or delete on public.farms for each row execute procedure public.log_audit_event();

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute procedure public.log_audit_event();

drop trigger if exists audit_egg_production on public.egg_production;
create trigger audit_egg_production after insert or update or delete on public.egg_production for each row execute procedure public.log_audit_event();

drop trigger if exists audit_poultry_inventory_events on public.poultry_inventory_events;
create trigger audit_poultry_inventory_events after insert or update or delete on public.poultry_inventory_events for each row execute procedure public.log_audit_event();

drop trigger if exists audit_feeds on public.feeds;
create trigger audit_feeds after insert or update or delete on public.feeds for each row execute procedure public.log_audit_event();

drop trigger if exists audit_vitamins on public.vitamins;
create trigger audit_vitamins after insert or update or delete on public.vitamins for each row execute procedure public.log_audit_event();

drop trigger if exists audit_feed_distribution on public.feed_distribution;
create trigger audit_feed_distribution after insert or update or delete on public.feed_distribution for each row execute procedure public.log_audit_event();

drop trigger if exists audit_vitamin_administration on public.vitamin_administration;
create trigger audit_vitamin_administration after insert or update or delete on public.vitamin_administration for each row execute procedure public.log_audit_event();

drop trigger if exists audit_health_records on public.health_records;
create trigger audit_health_records after insert or update or delete on public.health_records for each row execute procedure public.log_audit_event();

drop trigger if exists audit_mortality_records on public.mortality_records;
create trigger audit_mortality_records after insert or update or delete on public.mortality_records for each row execute procedure public.log_audit_event();

drop trigger if exists audit_notifications on public.notifications;
create trigger audit_notifications after insert on public.notifications for each row execute procedure public.log_audit_event();

drop trigger if exists audit_system_settings on public.system_settings;
create trigger audit_system_settings after update on public.system_settings for each row execute procedure public.log_audit_event();

drop trigger if exists audit_smtp_settings on public.smtp_settings;
create trigger audit_smtp_settings after update on public.smtp_settings for each row execute procedure public.log_audit_event();

drop trigger if exists audit_notification_settings on public.notification_settings;
create trigger audit_notification_settings after update on public.notification_settings for each row execute procedure public.log_audit_event();

drop trigger if exists audit_notification_templates on public.notification_templates;
create trigger audit_notification_templates after update on public.notification_templates for each row execute procedure public.log_audit_event();

-- ── Client-triggered audit events ────────────────────────────────────────
-- The handful of real actions with no table mutation to hang a trigger on:
-- Login, Logout, Password Changed, Report Exported. security definer so the
-- client never needs (and never gets) a raw INSERT policy on audit_logs —
-- user_id/role/farm are read server-side from auth.uid(), never trusted from
-- client-supplied parameters, so a compromised client can't forge a row
-- attributed to someone else.
create or replace function public.log_client_audit_event(
  p_module text,
  p_action text,
  p_description text default null,
  p_severity text default 'info',
  p_status text default 'success',
  p_device text default null,
  p_browser text default null,
  p_os text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_user_role public.user_role;
  v_farm_id uuid;
  v_farm_name text;
begin
  if v_user_id is null then
    return;
  end if;

  select name, role, farm_id into v_user_name, v_user_role, v_farm_id from public.profiles where id = v_user_id;
  if v_farm_id is not null then
    select name into v_farm_name from public.farms where id = v_farm_id;
  end if;

  insert into public.audit_logs (
    user_id, user_name, user_role, farm_id, farm_name, module, action, description,
    severity, status, device, browser, operating_system
  )
  values (
    v_user_id, v_user_name, v_user_role, v_farm_id, v_farm_name, p_module, p_action, p_description,
    p_severity, p_status, p_device, p_browser, p_os
  );
end;
$$;

grant execute on function public.log_client_audit_event(text, text, text, text, text, text, text, text) to authenticated;

-- ── Health/Mortality alerts ──────────────────────────────────────────────
-- disease_outbreak/mortality_threshold_exceeded reuse the exact 5%-of-farm-
-- stock/7-day heuristic already proven in notify_inventory_alerts() — a
-- read-only cross-reference against poultry_inventory_events for the stock
-- denominator only, no write coupling (Mortality Records stays independent,
-- per the scoping decision above). mortality_threshold_exceeded is
-- deliberately a different category than the existing mortality_alert
-- (sourced from poultry_inventory_events) so the two independent systems'
-- per-category/per-day dedup checks never suppress each other.
alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in (
  'low_feed_stock', 'low_vitamin_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
  'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
  'expiring_medicine', 'low_egg_production', 'new_staff_account',
  'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted'
));

create or replace function public.notify_health_case_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'health_case_submitted', 'info', 'New health case submitted',
           new.disease_condition || ' reported in ' || new.house_pen || ' (' || new.affected_birds || ' birds affected).',
           '/farm/health'
    from public.profiles
    where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;
  return new;
end;
$$;

drop trigger if exists on_health_record_submitted_notify on public.health_records;
create trigger on_health_record_submitted_notify
  after insert on public.health_records
  for each row execute procedure public.notify_health_case_submitted();

create or replace function public.notify_mortality_case_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'mortality_case_submitted', 'info', 'New mortality case submitted',
           new.dead_birds || ' bird(s) reported dead in ' || new.house_pen || ' — ' || new.cause_of_death || '.',
           '/farm/mortality'
    from public.profiles
    where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;
  return new;
end;
$$;

drop trigger if exists on_mortality_record_submitted_notify on public.mortality_records;
create trigger on_mortality_record_submitted_notify
  after insert on public.mortality_records
  for each row execute procedure public.notify_mortality_case_submitted();

create or replace function public.notify_disease_outbreak()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_name text;
  v_stock int;
  v_affected_7d int;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  select name into v_farm_name from public.farms where id = new.farm_id;

  select coalesce(sum(quantity), 0) into v_stock
  from public.poultry_inventory_events
  where farm_id = new.farm_id and event_type <> 'transfer';

  select coalesce(sum(affected_birds), 0) into v_affected_7d
  from public.health_records
  where farm_id = new.farm_id
    and disease_condition = new.disease_condition
    and status = 'approved'
    and record_date >= (new.record_date - interval '7 days');

  if v_stock > 0 and v_affected_7d > (0.05 * v_stock) and not exists (
    select 1 from public.notifications
    where farm_id = new.farm_id and category = 'disease_outbreak' and created_at >= date_trunc('day', now())
  ) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'disease_outbreak', 'critical', 'Disease Outbreak Detected',
           v_farm_name || ' has ' || v_affected_7d || ' birds affected by ' || new.disease_condition ||
             ' in the last 7 days (over 5% of its stock).',
           '/dashboard/production/health'
    from public.profiles where role = 'Super Admin';

    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'disease_outbreak', 'critical', 'Disease Outbreak Detected',
           'Your farm has ' || v_affected_7d || ' birds affected by ' || new.disease_condition ||
             ' in the last 7 days (over 5% of your stock).',
           '/farm/health'
    from public.profiles where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;

  return new;
end;
$$;

drop trigger if exists on_health_record_notify_outbreak on public.health_records;
create trigger on_health_record_notify_outbreak
  after insert or update on public.health_records
  for each row execute procedure public.notify_disease_outbreak();

create or replace function public.notify_mortality_threshold()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_name text;
  v_stock int;
  v_dead_7d int;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  select name into v_farm_name from public.farms where id = new.farm_id;

  select coalesce(sum(quantity), 0) into v_stock
  from public.poultry_inventory_events
  where farm_id = new.farm_id and event_type <> 'transfer';

  select coalesce(sum(dead_birds), 0) into v_dead_7d
  from public.mortality_records
  where farm_id = new.farm_id
    and status = 'approved'
    and record_date >= (new.record_date - interval '7 days');

  if v_stock > 0 and v_dead_7d > (0.05 * v_stock) and not exists (
    select 1 from public.notifications
    where farm_id = new.farm_id and category = 'mortality_threshold_exceeded' and created_at >= date_trunc('day', now())
  ) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'mortality_threshold_exceeded', 'critical', 'Mortality Threshold Exceeded',
           v_farm_name || ' has recorded ' || v_dead_7d || ' deaths in the last 7 days (over 5% of its stock).',
           '/dashboard/production/mortality'
    from public.profiles where role = 'Super Admin';

    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'mortality_threshold_exceeded', 'critical', 'Mortality Threshold Exceeded',
           'Your farm has recorded ' || v_dead_7d || ' deaths in the last 7 days (over 5% of your stock).',
           '/farm/mortality'
    from public.profiles where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;

  return new;
end;
$$;

drop trigger if exists on_mortality_record_notify_threshold on public.mortality_records;
create trigger on_mortality_record_notify_threshold
  after insert or update on public.mortality_records
  for each row execute procedure public.notify_mortality_threshold();

-- ── Sales & Expenses ─────────────────────────────────────────────────────
-- A real financial ledger, deliberately independent from egg_production's
-- eggs_sold and poultry_inventory_events' 'sale' event type — those are
-- operational quantity counters with no price attached; this is the money
-- side (who paid what, for how much), not auto-reconciled against either.
-- No approval workflow — mirrors feeds/vitamins' shape (Farm Admin/Manager
-- write, Super Admin read-only), not egg_production's Staff-submits shape.
-- Staff gets no policy on either table at all, matching the nav (Staff has
-- zero access to Sales & Expenses today).
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  sale_date date not null default current_date,
  item_category text not null check (item_category in ('Eggs', 'Live Birds', 'Manure', 'Other')),
  description text,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  unit_price numeric not null check (unit_price >= 0),
  total_amount numeric not null check (total_amount >= 0),
  buyer_name text,
  payment_status text not null default 'paid' check (payment_status in ('paid', 'pending', 'partial')),
  payment_method text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  expense_date date not null default current_date,
  category text not null check (category in ('Feed', 'Medicine & Vitamins', 'Utilities', 'Labor', 'Maintenance', 'Transport', 'Equipment', 'Other')),
  description text not null,
  amount numeric not null check (amount > 0),
  payment_method text,
  vendor text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_sales_updated_at on public.sales;
create trigger set_sales_updated_at
  before update on public.sales
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
  before update on public.expenses
  for each row execute procedure public.handle_updated_at();

alter table public.sales enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Super Admin can view all sales" on public.sales;
create policy "Super Admin can view all sales"
  on public.sales for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's sales" on public.sales;
create policy "Farm Admin or Manager can manage their farm's sales"
  on public.sales for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Super Admin can view all expenses" on public.expenses;
create policy "Super Admin can view all expenses"
  on public.expenses for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's expenses" on public.expenses;
create policy "Farm Admin or Manager can manage their farm's expenses"
  on public.expenses for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

create index if not exists sales_farm_id_idx on public.sales (farm_id);
create index if not exists sales_sale_date_idx on public.sales (sale_date);
create index if not exists expenses_farm_id_idx on public.expenses (farm_id);
create index if not exists expenses_expense_date_idx on public.expenses (expense_date);

-- Reuses log_audit_event() (defined earlier in this file, extended above for
-- these two tables) — attached here, after the tables exist.
drop trigger if exists audit_sales on public.sales;
create trigger audit_sales after insert or update or delete on public.sales for each row execute procedure public.log_audit_event();

drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses after insert or update or delete on public.expenses for each row execute procedure public.log_audit_event();

-- ── Profile Module ───────────────────────────────────────────────────────

-- Split name fields — additive alongside the existing single `name` column,
-- which stays the source every other table/trigger already reads (audit
-- logs' user_name, staff lists, etc.). The Personal Information form writes
-- all four together, recomputing `name` from the parts in the same UPDATE.
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists middle_name text;
alter table public.profiles add column if not exists last_name text;

-- Closes a real gap: prevent_self_privilege_escalation() (defined earlier)
-- already blocks a user from self-editing role/status/farm_id, but never
-- guarded the Staff-Management HR fields (assigned_house_pen/position/
-- employment_status/employee_id) — those were only ever set through the Farm
-- Admin's Staff Management UI, never actually protected at the RLS/trigger
-- layer. That gap becomes exploitable the moment a self-service "Personal
-- Information" form exists, so it's closed here as part of this feature. The
-- Farm-Admin-editing-a-staff-row branch above is untouched — a Farm Admin
-- still sets these fields exactly as before via Staff Management.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if public.current_user_role() = 'Farm Admin' and old.role = 'Staff' then
    if new.role is distinct from old.role then
      raise exception 'Farm Admin cannot change a staff member''s role';
    end if;
    if new.farm_id is distinct from old.farm_id then
      if not (old.farm_id is null or old.farm_id = public.current_farm_id())
         or new.farm_id is distinct from public.current_farm_id() then
        raise exception 'Farm Admin can only assign staff into their own farm';
      end if;
    end if;
    return new;
  end if;

  if (new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.farm_id is distinct from old.farm_id
      or new.assigned_house_pen is distinct from old.assigned_house_pen
      or new.position is distinct from old.position
      or new.employment_status is distinct from old.employment_status
      or new.employee_id is distinct from old.employee_id) then
    raise exception 'Only a Super Admin or your Farm Admin can change role, status, farm, or work assignment';
  end if;
  return new;
end;
$$;

-- ── Active sessions ──────────────────────────────────────────────────────
-- One row per (user, device install) — upserted on sign-in and touched
-- (throttled client-side) on session rehydration. Self-only, no oversight
-- view: matches the spec's own access table ("Manage Own Sessions" only).
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null,
  device text not null,
  browser text not null,
  operating_system text not null,
  last_activity timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);

alter table public.user_sessions enable row level security;

drop policy if exists "Users can manage their own sessions" on public.user_sessions;
create policy "Users can manage their own sessions"
  on public.user_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists user_sessions_user_id_idx on public.user_sessions (user_id);

-- ── Per-user appearance preferences ──────────────────────────────────────
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "Users can manage their own preferences" on public.user_preferences;
create policy "Users can manage their own preferences"
  on public.user_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure public.handle_updated_at();

-- ── Per-user notification preferences ────────────────────────────────────
-- `category` is one of 6 app-level groups (production/inventory/health/
-- mortality/approval/system), not the ~20 raw notification_category values —
-- a missing row means "on" (default), so existing users need no seeding.
-- This is a read-side filter on the current user's own Notifications view,
-- not a write-side gate on notification creation — the existing per-category
-- generation logic (notification_settings, Super-Admin-controlled, global)
-- is untouched.
create table if not exists public.user_notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.user_notification_preferences enable row level security;

drop policy if exists "Users can manage their own notification preferences" on public.user_notification_preferences;
create policy "Users can manage their own notification preferences"
  on public.user_notification_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Avatar photo storage ─────────────────────────────────────────────────
-- Public bucket (a profile photo isn't sensitive, same tier as
-- system-assets) — each user's files live under a `{user_id}/...` folder
-- prefix, so RLS can scope writes without a lookup table.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Poultry Inventory consolidation ──────────────────────────────────────
-- UI-only merge of the Poultry Inventory / Feed & Vitamins / Mortality
-- Records pages into one tabbed "Poultry Inventory" module — these tables
-- stay separate entities, nothing here changes that. The two additive
-- column sets below close a real gap the merge surfaced: approving a
-- mortality_records row previously had no effect on poultry stock at all
-- (two disconnected mortality-tracking paths), and mortality_records had no
-- bird-type column to subtract stock per type or to show a "Poultry Type"
-- column, which the spec requires.

-- Reuses the existing poultry_bird_type enum — no new type. Nullable:
-- existing rows are grandfathered null (unknown type), new submissions
-- require it at the application layer (the form), not the database.
alter table public.mortality_records add column if not exists bird_type public.poultry_bird_type;

-- The event-sourced ledger only ever recorded movements (who/what/when/how
-- many) — the spec's "Poultry Stock" table also wants batch-descriptive
-- attributes. Meaningful mainly on 'arrival' rows (a batch of birds
-- arriving); optional and blank on every other event type, same
-- "add nullable column, fill in progressively" pattern used everywhere else
-- in this file (e.g. Staff Management's HR fields on profiles).
alter table public.poultry_inventory_events add column if not exists breed text;
alter table public.poultry_inventory_events add column if not exists age_label text;
alter table public.poultry_inventory_events add column if not exists source text;
alter table public.poultry_inventory_events add column if not exists status text;
