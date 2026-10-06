-- PoultryHub — migration 0001_08: notifications.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers the
-- "notifications" category: the generic per-recipient inbox (one row per
-- recipient, fanned out at generation time — the standard inbox pattern,
-- keeping read/archived state naturally per-user with a single RLS rule)
-- plus the two automatic triggers that don't belong to any other module
-- (new user registration, new staff account — everything else's own
-- notify_*() trigger lives in that module's own file, e.g.
-- notify_inventory_alerts() in 0001_04_poultry_inventory.sql).
--
-- `category` is a checked text column, not a Postgres enum: this list is
-- expected to grow, and enum ALTER TYPE ADD VALUE has transaction
-- restrictions none of this project's other (small, stable) enums need to
-- deal with. The original single-file schema.sql grew this CHECK constraint
-- through 3 sequential DROP+ADD ALTERs as later modules were built (Feeds &
-- Vitamins added low_vitamin_stock, Health/Mortality added 4 more) — this
-- file just states the current, final list once; there's no reason to
-- replay that history in a fresh snapshot.
--
-- Depends on 0001_01_users_auth.sql and 0001_02_farms.sql.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  farm_id uuid references public.farms (id) on delete cascade,
  category text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  link text,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz
);

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in (
  'low_feed_stock', 'low_vitamin_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
  'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
  'expiring_medicine', 'low_egg_production', 'new_staff_account',
  'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted'
));

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (recipient_id = auth.uid());

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Staff can view/mark-as-read but never archive or delete — enforced here,
-- not just hidden in the UI, so it can't be bypassed by calling the API
-- directly. Everyone else (Super Admin/Farm Admin/Manager) can delete.
drop policy if exists "Recipient can delete their own notifications unless Staff" on public.notifications;
create policy "Recipient can delete their own notifications unless Staff"
  on public.notifications for delete
  using (recipient_id = auth.uid() and public.current_user_role() in ('Super Admin', 'Farm Admin', 'Manager'));

-- Manual sends: a Farm Admin/Manager can notify a specific staff member on
-- their own farm (e.g. a task assignment or a reminder) — real, human
-- authored content, not a fabricated automated source. System-generated
-- notifications (every notify_*() trigger across this schema) are inserted
-- by security definer functions, which bypass this policy the same way
-- is_super_admin()/current_farm_id() already bypass profiles' RLS.
drop policy if exists "Farm Admin or Manager can notify their farm's staff" on public.notifications;
create policy "Farm Admin or Manager can notify their farm's staff"
  on public.notifications for insert
  with check (
    public.current_user_role() in ('Farm Admin', 'Manager')
    and farm_id = public.current_farm_id()
    and exists (
      select 1 from public.profiles p
      where p.id = recipient_id and p.farm_id = public.current_farm_id()
    )
  );

-- Only `status` (and its read_at/archived_at bookkeeping) may change after
-- creation — same shape as prevent_farm_field_overreach() (0001_02). Staff
-- can move unread -> read but never -> archived.
create or replace function public.enforce_notification_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if new.recipient_id is distinct from old.recipient_id
     or new.farm_id is distinct from old.farm_id
     or new.category is distinct from old.category
     or new.title is distinct from old.title
     or new.message is distinct from old.message then
    raise exception 'Only a notification''s status can be changed';
  end if;

  if new.status = 'archived' and public.current_user_role() = 'Staff' then
    raise exception 'Staff cannot archive notifications';
  end if;

  if new.status = 'read' and old.status = 'unread' and new.read_at is null then
    new.read_at := now();
  end if;
  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_notification_status_only on public.notifications;
create trigger enforce_notification_status_only
  before update on public.notifications
  for each row execute procedure public.enforce_notification_update();

create index if not exists notifications_recipient_id_idx on public.notifications (recipient_id);
create index if not exists notifications_farm_id_idx on public.notifications (farm_id);
create index if not exists notifications_status_idx on public.notifications (status);
create index if not exists notifications_category_idx on public.notifications (category);
create index if not exists notifications_created_at_idx on public.notifications (created_at);

-- New User Registration (Super Admin): every new profile row, fan out to
-- every other Super Admin (excludes the row's own id — relevant for the
-- very first signup, which bootstraps itself into Super Admin and would
-- otherwise notify itself about its own registration). References
-- public.notification_settings, created in 0001_10_system_settings.sql —
-- safe, lazy function body, same reasoning noted throughout this file set.
create or replace function public.notify_new_user_registration()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not coalesce((select enabled from public.notification_settings where category = 'new_user_registration'), true) then
    return new;
  end if;

  insert into public.notifications (recipient_id, category, severity, title, message, link)
  select id, 'new_user_registration', 'info', 'New user registered',
         new.name || ' (' || new.role || ') just signed up.',
         '/dashboard/users'
  from public.profiles
  where role = 'Super Admin' and id <> new.id;
  return new;
end;
$$;

drop trigger if exists on_profile_created_notify on public.profiles;
create trigger on_profile_created_notify
  after insert on public.profiles
  for each row execute procedure public.notify_new_user_registration();

-- New Staff Account (Farm Admin/Manager): fires when a Staff row's farm_id
-- transitions into a farm — covers both createStaffAccount's follow-up
-- UPDATE and claimStaff, since neither sets farm_id at insert time.
create or replace function public.notify_new_staff_account()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role = 'Staff' and new.farm_id is not null and new.farm_id is distinct from old.farm_id
     and coalesce((select enabled from public.notification_settings where category = 'new_staff_account'), true) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'new_staff_account', 'info', 'New staff account',
           new.name || ' was added to your farm.',
           '/farm/staff'
    from public.profiles
    where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_updated_notify_staff on public.profiles;
create trigger on_profile_updated_notify_staff
  after update on public.profiles
  for each row execute procedure public.notify_new_staff_account();

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_08_notifications')
on conflict (version) do nothing;
