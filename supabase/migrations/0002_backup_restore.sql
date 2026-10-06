-- PoultryHub — migration 0002: Backup & Restore (Super Admin).
--
-- "Backup" here is an application-data snapshot, not a Postgres-engine
-- backup — this app has no server component, and a real pg_dump/PITR needs
-- a Management API secret that must never live in client code (Supabase
-- already handles that at the infrastructure level). What's captured is the
-- operational/business data only: farms, feeds, vitamins, egg_production,
-- poultry_inventory_events, feed_distribution, vitamin_administration,
-- health_records, mortality_records, sales, expenses — stored as one jsonb
-- blob per backup row, no new Storage bucket, no secrets.
--
-- Deliberately EXCLUDED from backup/restore scope: profiles/user accounts
-- (restoring users risks corrupting the profiles.id -> auth.users link),
-- roles/permissions/role_permissions (RBAC config), notifications
-- (transient), audit_logs/login_history/failed_login_attempts (these ARE
-- the audit trail — restoring old rows into an append-only history
-- corrupts it), every settings-singleton table, schema_migrations, and the
-- Profile Module's user_sessions/user_preferences/user_notification_preferences.
--
-- Restore is a safe merge/upsert by id — it never deletes anything, so a
-- record added after the backup was taken survives a restore untouched.
--
-- Depends on 0001_01 (is_super_admin, profiles), 0001_05 (feeds/vitamins
-- stock-delta triggers this migration must disable during restore), 0001_11
-- (audit_logs table + log_client_audit_event, reused but NOT extended —
-- see the note above the RLS section below for why the generic
-- log_audit_event() trigger is deliberately not attached to the two new
-- tables here).

create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('manual', 'scheduled')),
  status text not null check (status in ('completed', 'failed')),
  label text,
  tables jsonb not null default '{}'::jsonb,
  table_counts jsonb not null default '{}'::jsonb,
  size_bytes bigint not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.backups enable row level security;

-- No insert/update policy at all — writes only happen through
-- create_backup()/restore_backup() below, both security definer, which
-- bypass RLS entirely (same pattern this schema already uses for
-- record_failed_login_attempt()/log_audit_event()).
drop policy if exists "Super Admin can view backups" on public.backups;
create policy "Super Admin can view backups"
  on public.backups for select
  using (public.is_super_admin());

drop policy if exists "Super Admin can delete backups" on public.backups;
create policy "Super Admin can delete backups"
  on public.backups for delete
  using (public.is_super_admin());

create index if not exists backups_created_at_idx on public.backups (created_at);
create index if not exists backups_type_idx on public.backups (type);

-- ── Scheduled backup configuration ──────────────────────────────────────
-- Singleton, same shape as system_settings/security_settings.
create table if not exists public.backup_schedule_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'monthly')),
  retention_count int not null default 30 check (retention_count >= 1),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.backup_schedule_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists set_backup_schedule_settings_updated_at on public.backup_schedule_settings;
create trigger set_backup_schedule_settings_updated_at
  before update on public.backup_schedule_settings
  for each row execute procedure public.handle_updated_at();

alter table public.backup_schedule_settings enable row level security;

drop policy if exists "Super Admin can view backup schedule settings" on public.backup_schedule_settings;
create policy "Super Admin can view backup schedule settings"
  on public.backup_schedule_settings for select
  using (public.is_super_admin());

drop policy if exists "Super Admin can update backup schedule settings" on public.backup_schedule_settings;
create policy "Super Admin can update backup schedule settings"
  on public.backup_schedule_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── Generic upsert helper ────────────────────────────────────────────────
-- Avoids hand-writing 11 upsert statements with hardcoded column lists.
-- Table/column names are quoted via %I; they come from a hardcoded internal
-- list (restore_backup() below) or the system catalog, never user input —
-- not an injection risk, %I is just for correct SQL generation.
create or replace function public.upsert_from_jsonb(p_table text, p_rows jsonb)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_cols text[];
  v_col_list text;
  v_update_list text;
  v_count integer;
begin
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    return 0;
  end if;

  select array_agg(column_name order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table;

  select string_agg(quote_ident(c), ', ') into v_col_list from unnest(v_cols) as c;
  select string_agg(quote_ident(c) || ' = excluded.' || quote_ident(c), ', ')
    into v_update_list
  from unnest(v_cols) as c
  where c <> 'id';

  execute format(
    'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (id) do update set %s',
    p_table, v_col_list, v_col_list, p_table, v_update_list
  ) using p_rows;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Postgres grants EXECUTE on every new function to PUBLIC by default —
-- without this, any authenticated (or even anon) client could call this
-- directly with an arbitrary table name and rows, upserting into ANY table
-- in the schema (e.g. forging a Super Admin profiles row) and completely
-- bypassing restore_backup()'s auth check, FK-safe ordering, and trigger
-- disabling. Internal helper only — revoke the implicit PUBLIC grant.
revoke execute on function public.upsert_from_jsonb(text, jsonb) from public;

-- ── Create a backup ──────────────────────────────────────────────────────
-- auth.uid() is null for a trusted internal caller (pg_cron) — same
-- distinction prevent_self_privilege_escalation()/record_failed_login_attempt()
-- already rely on. The check is unconditional on identity, NOT on p_type —
-- a caller-supplied parameter is never a trust boundary on its own.
create or replace function public.create_backup(p_type text default 'manual', p_label text default null)
returns public.backups
language plpgsql
security definer set search_path = public
as $$
declare
  v_backup public.backups;
  v_tables jsonb;
  v_counts jsonb;
  v_user_id uuid := auth.uid();
  v_user_name text;
begin
  if v_user_id is not null and not public.is_super_admin() then
    raise exception 'Only Super Admin can create backups';
  end if;

  if v_user_id is not null then
    select name into v_user_name from public.profiles where id = v_user_id;
  end if;

  -- One single statement — every sub-select shares the same per-statement
  -- MVCC snapshot, so this is a genuinely consistent point-in-time capture,
  -- not 11 separate round trips that could interleave with concurrent writes.
  select jsonb_build_object(
    'farms', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.farms t), '[]'::jsonb),
    'feeds', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.feeds t), '[]'::jsonb),
    'vitamins', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.vitamins t), '[]'::jsonb),
    'egg_production', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.egg_production t), '[]'::jsonb),
    'poultry_inventory_events', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.poultry_inventory_events t), '[]'::jsonb),
    'feed_distribution', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.feed_distribution t), '[]'::jsonb),
    'vitamin_administration', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.vitamin_administration t), '[]'::jsonb),
    'health_records', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.health_records t), '[]'::jsonb),
    'mortality_records', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.mortality_records t), '[]'::jsonb),
    'sales', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.sales t), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.expenses t), '[]'::jsonb)
  ) into v_tables;

  select jsonb_object_agg(key, jsonb_array_length(value)) into v_counts
  from jsonb_each(v_tables);

  insert into public.backups (type, status, label, tables, table_counts, size_bytes, created_by, created_by_name)
  values (p_type, 'completed', p_label, v_tables, v_counts, octet_length(v_tables::text), v_user_id, v_user_name)
  returning * into v_backup;

  return v_backup;
exception
  when others then
    -- A visible 'failed' row matters most for the unattended scheduled
    -- path — nothing else would ever surface a silent failure there.
    insert into public.backups (type, status, label, error_message, created_by, created_by_name)
    values (p_type, 'failed', p_label, sqlerrm, v_user_id, v_user_name);
    raise;
end;
$$;

-- Must revoke the implicit PUBLIC grant before granting to authenticated
-- only — otherwise anon (an unauthenticated request) can still call this
-- via PUBLIC, and since auth.uid() is ALSO null for a genuinely anonymous
-- caller (not just for pg_cron's internal call), the "auth.uid() is null
-- means trusted internal caller" check above would wrongly treat an anon
-- request as trusted and skip the Super Admin check entirely.
revoke execute on function public.create_backup(text, text) from public;
grant execute on function public.create_backup(text, text) to authenticated;

-- ── Restore a backup (safe merge — never deletes) ───────────────────────
create or replace function public.restore_backup(p_backup_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_backup public.backups;
  v_result jsonb := '{}'::jsonb;
  v_table text;
  v_count integer;
  -- FK-safe order: farms/feeds/vitamins are the only referenced parents
  -- among these 11 tables (feed_distribution.feed_id, vitamin_administration.vitamin_id,
  -- everything else only farm_id) — verified against each table's own
  -- migration file, not assumed.
  v_order text[] := array[
    'farms', 'feeds', 'vitamins', 'egg_production', 'poultry_inventory_events',
    'feed_distribution', 'vitamin_administration', 'health_records',
    'mortality_records', 'sales', 'expenses'
  ];
begin
  if not public.is_super_admin() then
    raise exception 'Only Super Admin can restore backups';
  end if;

  select * into v_backup from public.backups where id = p_backup_id;
  if not found then
    raise exception 'Backup % not found', p_backup_id;
  end if;

  foreach v_table in array v_order loop
    begin
      -- Required, not optional: without disabling triggers, restoring
      -- feed_distribution/vitamin_administration rows re-fires
      -- apply_feed_stock_delta()/apply_vitamin_stock_delta() (0001_05) on
      -- top of feeds/vitamins rows ALSO being restored to their already-
      -- correct backed-up stock levels, double-counting any status
      -- transition that happened between backup and restore. It also
      -- silences the generic log_audit_event()/notify_*() triggers, which
      -- would otherwise flood the audit log with thousands of per-row
      -- entries and regenerate stale notifications for old data. This is
      -- standard practice for bulk data reload (pg_dump/pg_restore's own
      -- --disable-triggers does the same). It's transactional DDL — if
      -- anything below raises, the whole transaction (including this
      -- disable) rolls back, so a failed restore can't leave triggers
      -- disabled. One side effect worth knowing: disabling triggers also
      -- means handle_updated_at() doesn't fire, so restored rows keep
      -- their original backed-up updated_at rather than jumping to "now" —
      -- the more correct restore semantic, stated here rather than left
      -- as a surprise.
      execute format('alter table public.%I disable trigger user', v_table);
      v_count := public.upsert_from_jsonb(v_table, v_backup.tables -> v_table);
      execute format('alter table public.%I enable trigger user', v_table);
    exception
      when others then
        raise exception 'Restore failed while restoring %: %', v_table, sqlerrm;
    end;
    v_result := v_result || jsonb_build_object(v_table, v_count);
  end loop;

  insert into public.audit_logs (user_id, user_name, user_role, module, action, description, severity, status)
  select id, name, role, 'System Settings', 'database_restored',
         'Restored data from backup created ' || to_char(v_backup.created_at, 'YYYY-MM-DD HH24:MI'),
         'critical', 'success'
  from public.profiles where id = auth.uid();

  return v_result;
end;
$$;

-- Same PUBLIC-grant trap as create_backup() above.
revoke execute on function public.restore_backup(uuid) from public;
grant execute on function public.restore_backup(uuid) to authenticated;

-- ── Scheduled execution (pg_cron) ────────────────────────────────────────
create or replace function public.run_scheduled_backup()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_settings public.backup_schedule_settings;
  v_last timestamptz;
  v_required interval;
  v_due boolean;
begin
  select * into v_settings from public.backup_schedule_settings where id = true;
  if v_settings is null or not v_settings.enabled then
    return;
  end if;

  select max(created_at) into v_last from public.backups where type = 'scheduled';

  v_required := case v_settings.frequency
    when 'daily' then interval '1 day'
    when 'weekly' then interval '7 days'
    when 'monthly' then interval '28 days'
  end;

  -- Computed as an explicit boolean, not a bare comparison: `now() - v_last
  -- >= v_required` evaluates to null (-> effectively "not due") when
  -- v_last is null, which would make the very first scheduled backup
  -- silently never fire and stay broken forever.
  v_due := v_last is null or now() - v_last >= v_required;
  if not v_due then
    return;
  end if;

  perform public.create_backup('scheduled', null);

  -- Prune old scheduled backups beyond retention_count, oldest first.
  -- Manual backups are never auto-deleted.
  delete from public.backups
  where id in (
    select id from public.backups
    where type = 'scheduled'
    order by created_at desc
    offset v_settings.retention_count
  );
end;
$$;

-- Same PUBLIC-by-default trap as upsert_from_jsonb above — revoke it.
-- Nothing but pg_cron should ever call this (it has no auth check at all,
-- unlike create_backup()'s conditional check, since pg_cron's invocation
-- has no auth.uid() to check against).
revoke execute on function public.run_scheduled_backup() from public;

-- If this errors with a permissions/ownership complaint, enable "pg_cron"
-- once via the Supabase Dashboard (Database -> Extensions) instead, then
-- re-run just this migration file from here down.
create extension if not exists pg_cron;

-- Fires at 2am in whatever timezone pg_cron's scheduler runs (commonly UTC
-- on Supabase, independent of system_settings.timezone) — adjust the cron
-- expression below before pasting if a specific local time matters. Safe
-- to re-paste: pg_cron upserts a job definition by name.
select cron.schedule('run_scheduled_backup_daily', '0 2 * * *', 'select public.run_scheduled_backup();');

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0002_backup_restore')
on conflict (version) do nothing;
