-- PoultryHub — migration 0001_11: audit logs.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers the
-- "audit_logs" category — a real, app-wide, immutable trail: every real
-- mutable table in the app gets an additive audit trigger, plus a small
-- secure RPC for the handful of real actions with no table mutation to hang
-- a trigger on (login/logout/password change/report export). No insert/
-- update/delete RLS policy exists for any role — the security definer
-- function/RPC below are the only writers, so logs are immutable by
-- construction.
--
-- REAL FIX vs. the original single-file schema.sql: that file only ever
-- ALTERed/renamed `audit_logs` (entity_type -> table_name, actor_id ->
-- user_id, etc.) — it assumed the table already existed from history no
-- longer represented anywhere in this project's current migrations (an
-- older, Health/Mortality-only version, predating the consolidated
-- schema.sql that predates this migrations split). On a genuinely fresh
-- database, every one of those ALTER statements would fail with "relation
-- public.audit_logs does not exist." The `create table if not exists` below
-- is new: it creates the table directly in its final, converged shape. On
-- your actual database (which already has the table, already in this
-- shape), it's a no-op and every ALTER/rename-guard below it stays exactly
-- as harmless as it always was. This only matters for ever bootstrapping a
-- genuinely fresh project from these files alone.
--
-- This file has to come after every table it attaches an audit trigger to
-- — farms/profiles (0001_01, 0001_02), egg_production (0001_03),
-- poultry_inventory_events (0001_04), feeds/vitamins/feed_distribution/
-- vitamin_administration (0001_05), health_records/mortality_records
-- (0001_06), sales/expenses (0001_07), notifications (0001_08),
-- system_settings/smtp_settings/notification_settings/notification_templates
-- (0001_10) — CREATE TRIGGER requires both the target table and the
-- trigger function to already exist.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  user_name text,
  user_role public.user_role,
  farm_id uuid references public.farms (id) on delete set null,
  farm_name text,
  module text not null,
  action text not null,
  description text,
  table_name text,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  device text,
  browser text,
  operating_system text,
  severity text not null default 'info',
  status text not null default 'success',
  created_at timestamptz not null default now()
);

-- Idempotent rename guards: on a database where audit_logs already existed
-- under its older, narrower column names, these fire once and only once —
-- on a table created fresh by the statement above, there's nothing to
-- rename, so every one of these is a no-op.
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
-- making the underlying change, same mechanism every notify_*() trigger
-- across this schema already uses against notifications. Attached purely
-- additively below.
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

drop trigger if exists audit_sales on public.sales;
create trigger audit_sales after insert or update or delete on public.sales for each row execute procedure public.log_audit_event();

drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses after insert or update or delete on public.expenses for each row execute procedure public.log_audit_event();

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

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_11_audit_logs')
on conflict (version) do nothing;
