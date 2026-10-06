-- PoultryHub — migration 0026: Feed/Vitamin form simplification, hardcoded
-- low-stock thresholds, optional vitamin expiration, optional mortality
-- cause of death.
--
-- The Add Feed/Vitamin Stock forms drop their "Minimum Stock Level" and
-- "Storage Location" fields entirely — low stock is now a fixed threshold
-- (10 bags for feed, 2 containers for vitamins; see feedStockStatus()/
-- vitaminStockStatus() in packages/shared/src/types/feedVitamin.ts), not a
-- per-batch value the Farm Admin has to set. `minimum_stock_level` and
-- `storage_location` stay on both tables (existing NOT NULL/default on
-- minimum_stock_level means new inserts that omit it are unaffected) purely
-- for backward compatibility with rows written before this change — nothing
-- in the app reads them anymore.
--
-- Vitamins gain two real fields the old form never had: vitamin_type
-- (Liquid/Solid/Tablet, required) and package_size (informational only,
-- never used to compute stock). Its expiration_date, previously required,
-- becomes optional — a vitamin's shelf life isn't always tracked.
--
-- Mortality's cause_of_death, previously required, also becomes optional
-- (the Mortality form no longer collects it — see MortalityRecordFormDrawer).
--
-- Depends on 0001_05_feeds_vitamins.sql (feeds/vitamins + their notify
-- triggers), 0001_06_health_mortality.sql (mortality_records),
-- 0010_notifications_realtime_and_review_alerts.sql (the current
-- notify_mortality_case_submitted() definition, superseded here).

alter table public.vitamins add column if not exists vitamin_type text not null default 'Liquid'
  check (vitamin_type in ('Liquid', 'Solid', 'Tablet'));
alter table public.vitamins add column if not exists package_size text;
alter table public.vitamins alter column expiration_date drop not null;

alter table public.mortality_records alter column cause_of_death drop not null;

-- ── Low stock alerts: hardcoded thresholds, not minimum_stock_level ──────

create or replace function public.notify_feed_alerts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_name text;
begin
  if new.remaining_stock > 10 then
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

  if new.remaining_stock <= 2
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

  -- expiration_date is now optional — NULL makes this whole comparison NULL
  -- (falsy), so a vitamin with no expiration date tracked simply never
  -- triggers this block, same as "no expiry" should mean.
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

-- ── Mortality submitted notification: cause_of_death is now optional ────

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
           new.dead_birds || ' bird(s) reported dead in ' || new.house_pen || coalesce(' — ' || new.cause_of_death, '') || '.',
           '/farm/mortality'
    from public.profiles
    where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;
  return new;
end;
$$;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0026_feed_vitamin_form_simplification')
on conflict (version) do nothing;
