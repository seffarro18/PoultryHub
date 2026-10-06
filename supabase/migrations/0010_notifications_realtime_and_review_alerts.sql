-- (a) Enable Realtime delivery for notifications — postgres_changes,
-- authorized per-subscriber by the existing RLS SELECT policy
-- ("recipient_id = auth.uid()"), no new policy needed.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- FULL (not the default primary-key-only) replica identity so postgres_changes
-- can evaluate a subscription's recipient_id=eq.<uid> filter against the OLD
-- row on UPDATE/DELETE too — otherwise a delete (already permitted by the
-- existing DELETE policy for Farm Admin/Manager/Super Admin) would silently
-- fail to reach any subscribed client.
alter table public.notifications replica identity full;

-- (b) New categories: "your submission was reviewed" — the confirmed gap
-- where Staff never hears back when their own record is approved/rejected.
alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in (
  'low_feed_stock', 'low_vitamin_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
  'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
  'expiring_medicine', 'low_egg_production', 'new_staff_account',
  'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed'
));

create or replace function public.notify_egg_production_reviewed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected')
     and new.recorded_by is not null
     and coalesce((select enabled from public.notification_settings where category = 'egg_production_reviewed'), true)
  then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    values (
      new.recorded_by, new.farm_id, 'egg_production_reviewed',
      case when new.status = 'approved' then 'info' else 'warning' end,
      case when new.status = 'approved' then 'Production record approved' else 'Production record needs correction' end,
      case when new.status = 'approved'
        then 'Your egg production entry for ' || new.production_date || ' (' || new.house_pen || ') was approved.'
        else 'Your egg production entry for ' || new.production_date || ' (' || new.house_pen || ') was rejected. Reason: ' ||
             coalesce(new.review_notes, 'No reason provided.')
      end,
      '/farm/egg-production'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_egg_production_reviewed_notify on public.egg_production;
create trigger on_egg_production_reviewed_notify
  after update on public.egg_production
  for each row execute procedure public.notify_egg_production_reviewed();

create or replace function public.notify_health_record_reviewed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected')
     and new.recorded_by is not null
     and coalesce((select enabled from public.notification_settings where category = 'health_record_reviewed'), true)
  then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    values (
      new.recorded_by, new.farm_id, 'health_record_reviewed',
      case when new.status = 'approved' then 'info' else 'warning' end,
      case when new.status = 'approved' then 'Health record approved' else 'Health record needs correction' end,
      case when new.status = 'approved'
        then 'Your health record for ' || new.house_pen || ' (' || new.disease_condition || ') was approved.'
        else 'Your health record for ' || new.house_pen || ' (' || new.disease_condition || ') was rejected. Reason: ' ||
             coalesce(new.review_notes, 'No reason provided.')
      end,
      '/farm/health'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_health_record_reviewed_notify on public.health_records;
create trigger on_health_record_reviewed_notify
  after update on public.health_records
  for each row execute procedure public.notify_health_record_reviewed();

create or replace function public.notify_mortality_record_reviewed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected')
     and new.recorded_by is not null
     and coalesce((select enabled from public.notification_settings where category = 'mortality_record_reviewed'), true)
  then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    values (
      new.recorded_by, new.farm_id, 'mortality_record_reviewed',
      case when new.status = 'approved' then 'info' else 'warning' end,
      case when new.status = 'approved' then 'Mortality record approved' else 'Mortality record needs correction' end,
      case when new.status = 'approved'
        then 'Your mortality report for ' || new.house_pen || ' (' || new.dead_birds || ' bird(s)) was approved.'
        else 'Your mortality report for ' || new.house_pen || ' (' || new.dead_birds || ' bird(s)) was rejected. Reason: ' ||
             coalesce(new.review_notes, 'No reason provided.')
      end,
      '/farm/mortality'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_mortality_record_reviewed_notify on public.mortality_records;
create trigger on_mortality_record_reviewed_notify
  after update on public.mortality_records
  for each row execute procedure public.notify_mortality_record_reviewed();

-- (c) notification_settings gating fix — 4 existing categories were never
-- added here, so Super Admin can't toggle them off; adding those plus the
-- 3 new review categories above (7 new rows total).
alter table public.notification_settings drop constraint if exists notification_settings_category_check;
alter table public.notification_settings add constraint notification_settings_category_check check (category in (
  'new_user_registration', 'new_staff_account', 'mortality_alert', 'low_inventory',
  'low_egg_production', 'low_feed_stock', 'low_vitamin_stock', 'expiring_medicine',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed'
));

insert into public.notification_settings (category) values
  ('disease_outbreak'), ('mortality_threshold_exceeded'),
  ('health_case_submitted'), ('mortality_case_submitted'),
  ('egg_production_reviewed'), ('health_record_reviewed'), ('mortality_record_reviewed')
on conflict (category) do nothing;

-- Add the matching settings-gate to the 4 categories above that previously
-- had none. Re-shipping each function body VERBATIM from
-- 0001_06_health_mortality.sql (the tables/triggers themselves are
-- untouched) with only the settings-gate condition added — not rewritten,
-- to avoid silently changing real threshold/window logic that already works.
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

  if v_stock > 0 and v_affected_7d > (0.05 * v_stock)
     and coalesce((select enabled from public.notification_settings where category = 'disease_outbreak'), true)
     and not exists (
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

  if v_stock > 0 and v_dead_7d > (0.05 * v_stock)
     and coalesce((select enabled from public.notification_settings where category = 'mortality_threshold_exceeded'), true)
     and not exists (
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

create or replace function public.notify_health_case_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'pending'
     and coalesce((select enabled from public.notification_settings where category = 'health_case_submitted'), true)
  then
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

create or replace function public.notify_mortality_case_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'pending'
     and coalesce((select enabled from public.notification_settings where category = 'mortality_case_submitted'), true)
  then
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

-- (d) Composite index matching the (farm_id, category, created_at) shape
-- every dedup check above (and the pre-existing ones in 0001_03–0001_06) uses.
create index if not exists notifications_dedup_idx on public.notifications (farm_id, category, created_at);

insert into public.schema_migrations (version) values ('0010_notifications_realtime_and_review_alerts')
on conflict (version) do nothing;
