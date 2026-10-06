-- PoultryHub — migration 0021: Egg Pricing & Expected Daily Production.
--
-- Adds three new farm-scoped tables so Farm Admin can configure what a farm
-- actually charges per egg size (egg_prices), keep an audit trail of price
-- changes (egg_price_history, populated automatically by a trigger — never
-- written directly by the client), and set a configurable "expected daily
-- production" estimate (production_settings: Active Layers x a %, default
-- 70). This is a different concept from egg_production.expected_eggs
-- (layer_count * 30, computed per-record) — that column is untouched.
--
-- Also adds sales.egg_size (nullable — only ever set for item_category =
-- 'Eggs') so a sale can record which size was sold, matched against
-- egg_prices for auto-fill on the client.
--
-- RLS on all three new tables copies the feeds/vitamins pattern verbatim
-- (0001_05_feeds_vitamins.sql): Farm Admin/Manager manage, Staff view-only,
-- Super Admin view-all.
--
-- Depends on 0001_01_users_auth.sql (current_user_role, is_super_admin,
-- handle_updated_at), 0001_02_farms.sql (current_farm_id, farms),
-- 0001_07_sales_expenses.sql (sales).

-- ── egg_prices ───────────────────────────────────────────────────────────
-- One row per farm per egg size (6 rows/farm) — seeded for every existing
-- farm below, and for every future farm by the trigger further down.

create table if not exists public.egg_prices (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  egg_size text not null check (egg_size in ('Peewee', 'Small', 'Medium', 'Large', 'X Large', 'Jumbo')),
  full_tray_price numeric not null default 0 check (full_tray_price >= 0),
  half_tray_price numeric not null default 0 check (half_tray_price >= 0),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, egg_size)
);

drop trigger if exists set_egg_prices_updated_at on public.egg_prices;
create trigger set_egg_prices_updated_at
  before update on public.egg_prices
  for each row execute procedure public.handle_updated_at();

alter table public.egg_prices enable row level security;

drop policy if exists "Super Admin can view all egg prices" on public.egg_prices;
create policy "Super Admin can view all egg prices"
  on public.egg_prices for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's egg prices" on public.egg_prices;
create policy "Farm Admin or Manager can manage their farm's egg prices"
  on public.egg_prices for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

-- Staff need read access to look prices up when recording a sale, but never
-- write rights — same shortage as Staff's view of feeds/vitamins batches.
drop policy if exists "Staff can view their farm's egg prices" on public.egg_prices;
create policy "Staff can view their farm's egg prices"
  on public.egg_prices for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

create index if not exists egg_prices_farm_id_idx on public.egg_prices (farm_id);

-- ── egg_price_history ───────────────────────────────────────────────────
-- Populated only by the trigger below, never written directly by the
-- client — same "database is the source of truth for the audit trail"
-- approach used throughout this schema.

create table if not exists public.egg_price_history (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  egg_size text not null,
  unit_type text not null check (unit_type in ('full_tray', 'half_tray')),
  previous_price numeric not null,
  new_price numeric not null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.egg_price_history enable row level security;

drop policy if exists "Super Admin can view all egg price history" on public.egg_price_history;
create policy "Super Admin can view all egg price history"
  on public.egg_price_history for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can view their farm's egg price history" on public.egg_price_history;
create policy "Farm Admin or Manager can view their farm's egg price history"
  on public.egg_price_history for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

create index if not exists egg_price_history_farm_id_idx on public.egg_price_history (farm_id);
create index if not exists egg_price_history_created_at_idx on public.egg_price_history (created_at);

-- One row per changed price column — editing only the full-tray price
-- doesn't fabricate a half-tray history entry. security definer so it can
-- insert regardless of the caller's own RLS write access to this table (no
-- policy above grants insert to anyone, on purpose).
create or replace function public.log_egg_price_history()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.full_tray_price is distinct from old.full_tray_price then
    insert into public.egg_price_history (farm_id, egg_size, unit_type, previous_price, new_price, updated_by)
    values (new.farm_id, new.egg_size, 'full_tray', old.full_tray_price, new.full_tray_price, new.updated_by);
  end if;
  if new.half_tray_price is distinct from old.half_tray_price then
    insert into public.egg_price_history (farm_id, egg_size, unit_type, previous_price, new_price, updated_by)
    values (new.farm_id, new.egg_size, 'half_tray', old.half_tray_price, new.half_tray_price, new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists log_egg_price_history_trigger on public.egg_prices;
create trigger log_egg_price_history_trigger
  after update on public.egg_prices
  for each row execute procedure public.log_egg_price_history();

-- ── production_settings ─────────────────────────────────────────────────
-- One row per farm — Expected Eggs/Day = Active Layers x this rate, always
-- computed on the client, never stored.

create table if not exists public.production_settings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null unique references public.farms (id) on delete cascade,
  expected_production_rate numeric not null default 70 check (expected_production_rate >= 0 and expected_production_rate <= 100),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_production_settings_updated_at on public.production_settings;
create trigger set_production_settings_updated_at
  before update on public.production_settings
  for each row execute procedure public.handle_updated_at();

alter table public.production_settings enable row level security;

drop policy if exists "Super Admin can view all production settings" on public.production_settings;
create policy "Super Admin can view all production settings"
  on public.production_settings for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's production settings" on public.production_settings;
create policy "Farm Admin or Manager can manage their farm's production settings"
  on public.production_settings for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Staff can view their farm's production settings" on public.production_settings;
create policy "Staff can view their farm's production settings"
  on public.production_settings for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

-- ── Seeding — every existing farm gets default prices/settings now, every
-- future farm gets them via the AFTER INSERT trigger below. Without this, a
-- brand-new farm's Egg Pricing / Expected Production pages would have
-- nothing to display.

create or replace function public.seed_egg_pricing_for_farm(p_farm_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.egg_prices (farm_id, egg_size, full_tray_price, half_tray_price)
  values
    (p_farm_id, 'Peewee', 220, 115),
    (p_farm_id, 'Small', 230, 125),
    (p_farm_id, 'Medium', 250, 130),
    (p_farm_id, 'Large', 260, 135),
    (p_farm_id, 'X Large', 270, 140),
    (p_farm_id, 'Jumbo', 330, 170)
  on conflict (farm_id, egg_size) do nothing;

  insert into public.production_settings (farm_id, expected_production_rate)
  values (p_farm_id, 70)
  on conflict (farm_id) do nothing;
end;
$$;

do $$
declare
  f record;
begin
  for f in select id from public.farms loop
    perform public.seed_egg_pricing_for_farm(f.id);
  end loop;
end $$;

create or replace function public.seed_egg_pricing_on_farm_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.seed_egg_pricing_for_farm(new.id);
  return new;
end;
$$;

drop trigger if exists seed_egg_pricing_on_farm_insert_trigger on public.farms;
create trigger seed_egg_pricing_on_farm_insert_trigger
  after insert on public.farms
  for each row execute procedure public.seed_egg_pricing_on_farm_insert();

-- ── sales.egg_size ───────────────────────────────────────────────────────
-- Nullable — only ever set when item_category = 'Eggs'. Same size list as
-- egg_prices.egg_size, kept as a plain check rather than a foreign key since
-- a sale should still display correctly even if that size's egg_prices row
-- were ever removed.

alter table public.sales add column if not exists egg_size text;

alter table public.sales drop constraint if exists sales_egg_size_check;
alter table public.sales add constraint sales_egg_size_check
  check (egg_size is null or egg_size in ('Peewee', 'Small', 'Medium', 'Large', 'X Large', 'Jumbo'));

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0021_egg_pricing_production_settings')
on conflict (version) do nothing;
