-- PoultryHub — migration 0001_03: egg production.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers the
-- "egg_production" category — the Staff-records/Farm-Admin-reviews approval
-- workflow this app's other approval-gated modules (feed distribution,
-- vitamin administration, health records, mortality records) all copy the
-- shape of. Depends on 0001_01_users_auth.sql and 0001_02_farms.sql.
--
-- notify_low_egg_production() references public.notification_settings,
-- which isn't created until 0001_10_system_settings.sql — safe, since a
-- plpgsql function body is only resolved when it actually fires (at that
-- point every migration file will have already run), unlike an RLS policy
-- expression, which is validated immediately at creation time.

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
-- Reused by feed_distribution/vitamin_administration/health_records/
-- mortality_records via the same production_status enum.

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

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_03_egg_production')
on conflict (version) do nothing;
