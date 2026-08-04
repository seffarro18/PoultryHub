-- PoultryHub — consolidated database schema.
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
--
-- This is the single source of truth for the schema — it replaces the old
-- schema.sql + numbered migration files (0002-0004), which are no longer
-- needed once this has been applied. Every statement here is written to be
-- a safe no-op if run again later, and to be safe to run on a database that
-- already has some or all of this applied (nothing gets dropped or wiped;
-- pre-existing accounts are grandfathered rather than reset).

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
