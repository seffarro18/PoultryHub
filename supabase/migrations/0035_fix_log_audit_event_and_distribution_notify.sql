-- PoultryHub — migration 0035: fix "record \"new\" has no field \"status\""
-- on Feed Distribution approval, and add the missing Staff notification.
--
-- ── ROOT CAUSE (confirmed by direct reproduction against the live database) ──
--
-- Approving a feed_distribution row fires apply_feed_stock_delta_trigger
-- (AFTER UPDATE, 0001_05), whose body does
--   `update public.feeds set remaining_stock = remaining_stock - new.quantity_used where id = new.feed_id`
-- — that nested UPDATE on `feeds` fires `feeds`' OWN audit trigger
-- (audit_feeds -> log_audit_event()). Inside log_audit_event()'s UPDATE
-- branch, one elsif reads:
--   elsif TG_TABLE_NAME in ('egg_production','feed_distribution','vitamin_administration','health_records','mortality_records')
--         and new.status is distinct from old.status then
-- For this invocation TG_TABLE_NAME = 'feeds', which has no `status` column
-- at all. The assumption that `TG_TABLE_NAME in (...) and new.status ...`
-- "safely" short-circuits for other tables is wrong: PL/pgSQL must resolve
-- every column reference in a combined boolean expression (bind the
-- attribute number of `new.status` against the CURRENT call's row type)
-- before it can evaluate the expression at all — regardless of whether the
-- left-hand TG_TABLE_NAME check would make the AND come out false. Nested
-- `elsif TG_TABLE_NAME = X then if new.status ... end if` does NOT have
-- this problem, because the inner statement is only parsed/executed once
-- control has actually entered that branch (true statement-level branching,
-- not expression-level AND). The same unsafe pattern was duplicated for
-- `tasks` (0011_tasks.sql) when task support was added — fixed here too,
-- even though it hasn't crashed yet, per the same reasoning: `tasks` is
-- reached in this same elsif chain, and any future table lacking `status`
-- being cascaded through here would hit the identical bug.
--
-- No schema change needed — `feed_distribution.status` (production_status
-- enum) already exists exactly as every prior migration assumed; verified
-- directly against the live database. This is purely a trigger-function fix.
--
-- ── SECOND GAP (confirmed: no trigger exists for either table) ──
--
-- `notify_egg_production_reviewed`/`notify_health_record_reviewed`/
-- `notify_mortality_record_reviewed` (0010) exist, but no equivalent was
-- ever added for feed_distribution/vitamin_administration — so an approved
-- or rejected distribution never notified the Staff member who submitted
-- it. Added here, modeled directly on notify_egg_production_reviewed's own
-- shape. Guarded to the Staff-submitted-then-reviewed-by-someone-else case
-- only (checks recorded_by's role = 'Staff') — Farm Admin/Manager's own
-- "record my own usage, pre-approved" shortcut (createApprovedFeedDistributionRecord)
-- inserts-then-approves as the same user, which would otherwise notify a
-- Farm Admin that their own action was "approved by the Farm Admin".
--
-- Depends on 0001_05_feeds_vitamins.sql (feed_distribution, vitamin_administration),
-- 0001_08_notifications.sql (notifications), 0001_11_audit_logs.sql (log_audit_event,
-- as re-shipped by 0011_tasks.sql).

-- ── 1. Fix log_audit_event(): nest TG_TABLE_NAME checks, never combine them
--       with new./old. column references in one boolean expression ────────

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
    when 'tasks' then 'Tasks'
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
    elsif TG_TABLE_NAME = 'tasks' then
      v_action := 'task_created'; v_severity := 'info';
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
    -- Nested, not combined via AND — see migration header for why this is
    -- the actual fix, not a stylistic change.
    elsif TG_TABLE_NAME in ('egg_production', 'feed_distribution', 'vitamin_administration', 'health_records', 'mortality_records') then
      if new.status is distinct from old.status then
        v_action := new.status::text;
        v_severity := case new.status::text when 'rejected' then 'warning' else 'info' end;
      else
        v_action := TG_TABLE_NAME || '_updated'; v_severity := 'info';
      end if;
    elsif TG_TABLE_NAME = 'tasks' then
      if new.status is distinct from old.status then
        v_action := new.status::text;
        v_severity := case new.status::text when 'blocked' then 'warning' else 'info' end;
      else
        v_action := TG_TABLE_NAME || '_updated'; v_severity := 'info';
      end if;
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

-- ── 2. Notify the submitting Staff member when their Feed Distribution /
--       Vitamin Administration record is approved or rejected ─────────────

create or replace function public.notify_feed_distribution_reviewed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected')
     and new.recorded_by is not null
     and exists (select 1 from public.profiles where id = new.recorded_by and role = 'Staff')
     and coalesce((select enabled from public.notification_settings where category = 'feed_distribution_reviewed'), true)
  then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    values (
      new.recorded_by, new.farm_id, 'feed_distribution_reviewed',
      case when new.status = 'approved' then 'info' else 'warning' end,
      case when new.status = 'approved' then 'Feed Distribution Approved' else 'Feed Distribution Needs Correction' end,
      case when new.status = 'approved'
        then 'Your feed distribution for ' || new.house_pen || ' (' || new.quantity_used || ' ' || new.unit || ') was approved.'
        else 'Your feed distribution for ' || new.house_pen || ' was rejected. Reason: ' || coalesce(new.review_notes, 'No reason provided.')
      end,
      '/farm/feed'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_feed_distribution_reviewed_notify on public.feed_distribution;
create trigger on_feed_distribution_reviewed_notify
  after update on public.feed_distribution
  for each row execute procedure public.notify_feed_distribution_reviewed();

create or replace function public.notify_vitamin_administration_reviewed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected')
     and new.recorded_by is not null
     and exists (select 1 from public.profiles where id = new.recorded_by and role = 'Staff')
     and coalesce((select enabled from public.notification_settings where category = 'vitamin_administration_reviewed'), true)
  then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    values (
      new.recorded_by, new.farm_id, 'vitamin_administration_reviewed',
      case when new.status = 'approved' then 'info' else 'warning' end,
      case when new.status = 'approved' then 'Vitamin Administration Approved' else 'Vitamin Administration Needs Correction' end,
      case when new.status = 'approved'
        then 'Your vitamin administration for ' || new.house_pen || ' (' || new.quantity_used || ' ' || new.unit || ') was approved.'
        else 'Your vitamin administration for ' || new.house_pen || ' was rejected. Reason: ' || coalesce(new.review_notes, 'No reason provided.')
      end,
      '/farm/vitamins'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_vitamin_administration_reviewed_notify on public.vitamin_administration;
create trigger on_vitamin_administration_reviewed_notify
  after update on public.vitamin_administration
  for each row execute procedure public.notify_vitamin_administration_reviewed();

-- ── 3. New notification categories ───────────────────────────────────────

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in (
  'low_feed_stock', 'low_vitamin_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
  'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
  'expiring_medicine', 'low_egg_production', 'new_staff_account',
  'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
  'egg_production_submitted', 'task_assigned', 'task_completed', 'task_problem_reported', 'task_comment_added',
  'staff_assignment_changed', 'feed_distribution_reviewed', 'vitamin_administration_reviewed'
));

alter table public.notification_settings drop constraint if exists notification_settings_category_check;
alter table public.notification_settings add constraint notification_settings_category_check check (category in (
  'new_user_registration', 'new_staff_account', 'mortality_alert', 'low_inventory',
  'low_egg_production', 'low_feed_stock', 'low_vitamin_stock', 'expiring_medicine',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
  'task_assigned', 'task_comment_added', 'task_problem_reported', 'task_completed',
  'egg_production_submitted', 'staff_assignment_changed',
  'feed_distribution_reviewed', 'vitamin_administration_reviewed'
));

insert into public.notification_settings (category) values
  ('feed_distribution_reviewed'), ('vitamin_administration_reviewed')
on conflict (category) do nothing;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0035_fix_log_audit_event_and_distribution_notify')
on conflict (version) do nothing;
