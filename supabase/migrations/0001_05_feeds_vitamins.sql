-- PoultryHub — migration 0001_05: feeds & vitamins.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers "feeds" /
-- "feed_transactions" (the real transaction table is `feed_distribution`)
-- and "vitamins" / "vitamin_transactions" (`vitamin_administration`).
--
-- Unlike Poultry Inventory (a pure event log, stock always derived), feeds
-- and vitamins are lot/batch-tracked: each row in `feeds`/`vitamins` is one
-- purchased batch (batch_number, supplier, purchase_date all describe *that*
-- batch), so `remaining_stock` is a real, stored, mutable column on the
-- batch itself — not summed at read time. `quantity` is the original
-- purchased amount and never changes; `remaining_stock` only moves via
-- approved distribution/administration records (the delta triggers below)
-- or a direct Farm Admin correction.
--
-- Depends on 0001_01_users_auth.sql and 0001_02_farms.sql.
-- notify_feed_alerts()/notify_vitamin_alerts() reference
-- public.notification_settings/public.notifications, both created in later
-- files — safe, same lazy-function-body reasoning noted in 0001_03/0001_04.

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

-- Low Feed Stock alert.
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

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_05_feeds_vitamins')
on conflict (version) do nothing;
