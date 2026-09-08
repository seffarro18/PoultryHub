-- PoultryHub — migration 0001_06: health & mortality records.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers
-- "health_records" and "mortality_records". Same Staff -> Farm Admin
-- approval workflow as feed_distribution/vitamin_administration, reusing
-- the same production_status enum. Farm Admin/Manager additionally get a
-- direct insert path (unlike Feeds & Vitamins) since the spec asks for
-- "complete CRUD" here, not just review — a Farm-Admin-authored record is
-- inserted pre-approved by the client. Deliberately independent from
-- poultry_inventory_events' own 'mortality' event type — a different
-- dimension (house/pen vs. bird type), a different purpose (compliance
-- record vs. quick stock log) — no write coupling between them.
--
-- Depends on 0001_01_users_auth.sql, 0001_02_farms.sql, and
-- 0001_04_poultry_inventory.sql (reuses the poultry_bird_type enum for
-- mortality_records.bird_type, added near the end of this file).
-- notify_*() functions here reference public.notifications, safe for the
-- same lazy-function-body reason noted in earlier files.

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

-- disease_outbreak/mortality_threshold_exceeded reuse the exact 5%-of-farm-
-- stock/7-day heuristic already proven in notify_inventory_alerts()
-- (0001_04) — a read-only cross-reference against poultry_inventory_events
-- for the stock denominator only, no write coupling (Mortality Records
-- stays independent, per this file's header). mortality_threshold_exceeded
-- is deliberately a different category than the existing mortality_alert
-- (sourced from poultry_inventory_events) so the two independent systems'
-- per-category/per-day dedup checks never suppress each other.

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

-- ── Poultry Inventory consolidation (mortality side) ─────────────────────
-- Reuses the existing poultry_bird_type enum (0001_04) — no new type.
-- Nullable: existing rows are grandfathered null (unknown type), new
-- submissions require it at the application layer (the form), not the
-- database. Lives here rather than in 0001_04 because it alters this file's
-- own table — the ALTER needs mortality_records to already exist.
alter table public.mortality_records add column if not exists bird_type public.poultry_bird_type;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_06_health_mortality')
on conflict (version) do nothing;
