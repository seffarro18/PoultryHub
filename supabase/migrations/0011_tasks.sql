-- Task assignment + task comments — a from-scratch build (no prior task
-- system existed in this schema). Farm Admin/Manager create and assign
-- tasks to their farm's Staff; Staff work them, comment on progress, report
-- problems, and mark them complete.

-- ── Enums ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('pending', 'in_progress', 'completed', 'blocked');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_comment_type') then
    create type public.task_comment_type as enum ('progress', 'problem', 'completion');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_problem_category') then
    create type public.task_problem_category as enum
      ('missing_supplies', 'equipment_problem', 'schedule_conflict', 'cannot_complete', 'other');
  end if;
end $$;

-- ── tasks ────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  status public.task_status not null default 'pending',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_schedule_order check (scheduled_start is null or scheduled_end is null or scheduled_end >= scheduled_start)
);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.handle_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "Farm Admin or Manager can view their farm's tasks" on public.tasks;
create policy "Farm Admin or Manager can view their farm's tasks"
  on public.tasks for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Farm Admin or Manager can create tasks for their farm" on public.tasks;
create policy "Farm Admin or Manager can create tasks for their farm"
  on public.tasks for insert
  with check (
    farm_id = public.current_farm_id()
    and public.current_user_role() in ('Farm Admin', 'Manager')
    and exists (
      select 1 from public.profiles p
      where p.id = assigned_to and p.farm_id = public.current_farm_id() and p.role = 'Staff' and p.status = 'active'
    )
  );

drop policy if exists "Farm Admin or Manager can manage their farm's tasks" on public.tasks;
create policy "Farm Admin or Manager can manage their farm's tasks"
  on public.tasks for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Farm Admin or Manager can delete their farm's tasks" on public.tasks;
create policy "Farm Admin or Manager can delete their farm's tasks"
  on public.tasks for delete
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Staff can view their own assigned tasks" on public.tasks;
create policy "Staff can view their own assigned tasks"
  on public.tasks for select
  using (assigned_to = auth.uid() and public.current_user_role() = 'Staff');

drop policy if exists "Staff can update their own assigned task's status" on public.tasks;
create policy "Staff can update their own assigned task's status"
  on public.tasks for update
  using (assigned_to = auth.uid() and public.current_user_role() = 'Staff')
  with check (assigned_to = auth.uid());

-- RLS alone can't express "only status may change, and only via a valid
-- transition" — same technique as prevent_farm_field_overreach().
create or replace function public.prevent_task_field_overreach()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if public.current_user_role() in ('Farm Admin', 'Manager') then
    if new.farm_id is distinct from old.farm_id or new.created_by is distinct from old.created_by then
      raise exception 'Cannot change a task''s farm or creator';
    end if;
    return new;
  end if;

  if public.current_user_role() = 'Staff' then
    if new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.assigned_to is distinct from old.assigned_to
       or new.farm_id is distinct from old.farm_id
       or new.created_by is distinct from old.created_by
       or new.scheduled_start is distinct from old.scheduled_start
       or new.scheduled_end is distinct from old.scheduled_end
    then
      raise exception 'Staff can only update a task''s status';
    end if;

    if new.status is distinct from old.status and not (
      (old.status in ('pending', 'blocked') and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status in ('completed', 'blocked'))
    ) then
      raise exception 'Invalid task status transition';
    end if;

    new.completed_at := case when new.status = 'completed' then coalesce(new.completed_at, now()) else null end;
    return new;
  end if;

  raise exception 'Not authorized to update this task';
end;
$$;

drop trigger if exists enforce_task_field_overreach on public.tasks;
create trigger enforce_task_field_overreach
  before update on public.tasks
  for each row execute procedure public.prevent_task_field_overreach();

create index if not exists tasks_farm_id_status_idx on public.tasks (farm_id, status);
create index if not exists tasks_assigned_to_status_idx on public.tasks (assigned_to, status);

-- ── task_comments ────────────────────────────────────────────────────────
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null default auth.uid(),
  comment text not null,
  comment_type public.task_comment_type not null default 'progress',
  problem_category public.task_problem_category,
  created_at timestamptz not null default now(),
  constraint task_comments_problem_category_check check (comment_type = 'problem' or problem_category is null)
);

alter table public.task_comments enable row level security;

drop policy if exists "Task participants can view its comments" on public.task_comments;
create policy "Task participants can view its comments"
  on public.task_comments for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (
          (t.farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
          or (t.assigned_to = auth.uid() and public.current_user_role() = 'Staff')
        )
    )
  );

drop policy if exists "Task participants can comment" on public.task_comments;
create policy "Task participants can comment"
  on public.task_comments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (
          (t.farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
          or (t.assigned_to = auth.uid() and public.current_user_role() = 'Staff')
        )
    )
  );
-- No update/delete policy — comments are immutable once posted, same
-- append-only principle as audit_logs.

create index if not exists task_comments_task_id_idx on public.task_comments (task_id, created_at);

-- ── Realtime — live status changes + live comment thread ───────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;
alter table public.tasks replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_comments'
  ) then
    alter publication supabase_realtime add table public.task_comments;
  end if;
end $$;
alter table public.task_comments replica identity full;

-- ── Manager staff-visibility gap fix ────────────────────────────────────
-- Pre-existing gap: only Farm Admin could see their farm's Staff via RLS on
-- profiles. Needed now so a Manager's assignee picker isn't silently empty.
-- Unlike Farm Admin, Manager doesn't claim unassigned self-registered staff
-- (no "or farm_id is null" branch).
drop policy if exists "Manager can view their farm's staff" on public.profiles;
create policy "Manager can view their farm's staff"
  on public.profiles for select
  using (public.current_user_role() = 'Manager' and role = 'Staff' and farm_id = public.current_farm_id());

-- ── Notification categories ─────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in (
  'low_feed_stock', 'low_vitamin_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
  'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
  'expiring_medicine', 'low_egg_production', 'new_staff_account',
  'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
  'task_assigned', 'task_comment_added', 'task_problem_reported', 'task_completed'
));

alter table public.notification_settings drop constraint if exists notification_settings_category_check;
alter table public.notification_settings add constraint notification_settings_category_check check (category in (
  'new_user_registration', 'new_staff_account', 'mortality_alert', 'low_inventory',
  'low_egg_production', 'low_feed_stock', 'low_vitamin_stock', 'expiring_medicine',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
  'task_assigned', 'task_comment_added', 'task_problem_reported', 'task_completed'
));

insert into public.notification_settings (category) values
  ('task_assigned'), ('task_comment_added'), ('task_problem_reported'), ('task_completed')
on conflict (category) do nothing;

-- Task assigned -> notify the assignee.
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce((select enabled from public.notification_settings where category = 'task_assigned'), true) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    values (
      new.assigned_to, new.farm_id, 'task_assigned', 'info', 'New Task Assigned',
      'You were assigned: ' || new.title,
      '/farm/tasks/' || new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_task_assigned_notify on public.tasks;
create trigger on_task_assigned_notify
  after insert on public.tasks
  for each row execute procedure public.notify_task_assigned();

-- Task completed -> notify the farm's Farm Admin/Manager.
create or replace function public.notify_task_completed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and coalesce((select enabled from public.notification_settings where category = 'task_completed'), true)
  then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'task_completed', 'info', 'Task Completed',
           new.title || ' was marked complete.',
           '/farm/tasks/' || new.id
    from public.profiles
    where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;
  return new;
end;
$$;

drop trigger if exists on_task_completed_notify on public.tasks;
create trigger on_task_completed_notify
  after update on public.tasks
  for each row execute procedure public.notify_task_completed();

-- Comment posted -> route by type. 'problem' fans out to Farm Admin/Manager
-- (never a plain reply — surfaced with more weight). 'progress' notifies
-- only the other single participant, never farm-wide, never both sides.
-- 'completion' comments get no separate notification — already covered by
-- notify_task_completed() on the status change itself.
create or replace function public.notify_task_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_task record;
begin
  select farm_id, assigned_to, created_by, title into v_task from public.tasks where id = new.task_id;
  if v_task is null then
    return new;
  end if;

  if new.comment_type = 'problem' then
    if coalesce((select enabled from public.notification_settings where category = 'task_problem_reported'), true) then
      insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
      select id, v_task.farm_id, 'task_problem_reported',
             case when new.problem_category in ('cannot_complete', 'equipment_problem') then 'critical' else 'warning' end,
             'Problem Reported', v_task.title || ': ' || new.comment,
             '/farm/tasks/' || new.task_id
      from public.profiles
      where farm_id = v_task.farm_id and role in ('Farm Admin', 'Manager');
    end if;
  elsif new.comment_type = 'progress' then
    if coalesce((select enabled from public.notification_settings where category = 'task_comment_added'), true) then
      insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
      values (
        case when new.user_id = v_task.assigned_to then coalesce(v_task.created_by, v_task.assigned_to) else v_task.assigned_to end,
        v_task.farm_id, 'task_comment_added', 'info', 'New Comment on ' || v_task.title, new.comment,
        '/farm/tasks/' || new.task_id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_task_comment_notify on public.task_comments;
create trigger on_task_comment_notify
  after insert on public.task_comments
  for each row execute procedure public.notify_task_comment();

-- ── Audit: tasks (standard, full-row) ───────────────────────────────────
-- Re-ships log_audit_event() verbatim from 0001_11_audit_logs.sql, adding:
--   - 'tasks' -> 'Tasks' to the module map
--   - tasks' own UPDATE branch (not joined to the approval-workflow list —
--     that branch's severity mapping doesn't fit task statuses)
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
    elsif TG_TABLE_NAME in ('egg_production', 'feed_distribution', 'vitamin_administration', 'health_records', 'mortality_records')
          and new.status is distinct from old.status then
      v_action := new.status::text;
      v_severity := case new.status::text when 'rejected' then 'warning' else 'info' end;
    elsif TG_TABLE_NAME = 'tasks' and new.status is distinct from old.status then
      v_action := new.status::text;
      v_severity := case new.status::text when 'blocked' then 'warning' else 'info' end;
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

drop trigger if exists audit_tasks on public.tasks;
create trigger audit_tasks
  after insert or update or delete on public.tasks
  for each row execute procedure public.log_audit_event();

-- ── Audit: task_comments (bespoke, metadata-only — never the comment body) ──
create or replace function public.log_task_comment_audit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_name text;
  v_user_role public.user_role;
  v_farm_id uuid;
  v_farm_name text;
  v_task_title text;
begin
  select name, role into v_user_name, v_user_role from public.profiles where id = new.user_id;
  select farm_id, title into v_farm_id, v_task_title from public.tasks where id = new.task_id;
  if v_farm_id is not null then
    select name into v_farm_name from public.farms where id = v_farm_id;
  end if;

  insert into public.audit_logs (
    user_id, user_name, user_role, farm_id, farm_name, module, action, description,
    table_name, record_id, severity, status
  ) values (
    new.user_id, v_user_name, v_user_role, v_farm_id, v_farm_name, 'Tasks',
    case new.comment_type
      when 'problem' then 'task_problem_reported'
      when 'completion' then 'task_completion_comment'
      else 'task_comment_added'
    end,
    'Posted a ' || new.comment_type || ' comment on task "' || coalesce(v_task_title, '?') || '"'
      || case when new.problem_category is not null then ' (' || new.problem_category || ')' else '' end,
    'task_comments', new.id,
    case new.comment_type when 'problem' then 'warning' else 'info' end, 'success'
  );
  return new;
end;
$$;

drop trigger if exists audit_task_comments on public.task_comments;
create trigger audit_task_comments
  after insert on public.task_comments
  for each row execute procedure public.log_task_comment_audit();

insert into public.schema_migrations (version) values ('0011_tasks')
on conflict (version) do nothing;
