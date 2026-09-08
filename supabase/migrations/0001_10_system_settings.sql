-- PoultryHub — migration 0001_10: system settings.
--
-- Part of the split-by-category baseline (see AGENTS.md). Not one of the
-- originally requested categories, but real, necessary infrastructure that
-- has to live somewhere: system_settings (branding/locale), the
-- system-assets storage bucket (logo upload), smtp_settings (SMTP reference
-- info, no password — a browser app can never safely hold SMTP credentials),
-- notification_settings (per-category global on/off, Super-Admin-only —
-- distinct from the Profile Module's *per-user* preferences in
-- 0001_12_profile_module.sql), and notification_templates (default title/
-- message for the 4 manually-sent categories).
--
-- Depends on 0001_01_users_auth.sql.

create table if not exists public.system_settings (
  id boolean primary key default true check (id),
  system_name text not null default 'PoultryHub',
  logo_url text,
  default_theme text not null default 'system' check (default_theme in ('light', 'dark', 'system')),
  language text not null default 'en-US',
  timezone text not null default 'Asia/Manila',
  date_format text not null default 'MM/DD/YYYY',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at
  before update on public.system_settings
  for each row execute procedure public.handle_updated_at();

alter table public.system_settings enable row level security;

-- World-readable: the login screen needs the system name/logo before
-- anyone has a session, same reasoning as security_settings.
drop policy if exists "Anyone can view system settings" on public.system_settings;
create policy "Anyone can view system settings"
  on public.system_settings for select
  using (true);

drop policy if exists "Super Admin can update system settings" on public.system_settings;
create policy "Super Admin can update system settings"
  on public.system_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── System assets storage (logo upload) ─────────────────────────────────
-- A Storage bucket is just a row in storage.buckets, and access control is
-- plain RLS on storage.objects — both provisionable right here, no
-- Supabase Dashboard access needed. File type/size limits are enforced
-- client-side (systemSettingsService.ts) rather than via bucket-level
-- file_size_limit/allowed_mime_types columns, since those columns' exact
-- availability varies by Supabase/Storage version and a mismatch there
-- would break this entire script running end to end.
insert into storage.buckets (id, name, public)
values ('system-assets', 'system-assets', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view system assets" on storage.objects;
create policy "Anyone can view system assets"
  on storage.objects for select
  using (bucket_id = 'system-assets');

drop policy if exists "Super Admin can upload system assets" on storage.objects;
create policy "Super Admin can upload system assets"
  on storage.objects for insert
  with check (bucket_id = 'system-assets' and public.is_super_admin());

drop policy if exists "Super Admin can update system assets" on storage.objects;
create policy "Super Admin can update system assets"
  on storage.objects for update
  using (bucket_id = 'system-assets' and public.is_super_admin());

drop policy if exists "Super Admin can delete system assets" on storage.objects;
create policy "Super Admin can delete system assets"
  on storage.objects for delete
  using (bucket_id = 'system-assets' and public.is_super_admin());

-- ── Email Configuration (SMTP / Notifications / Templates) ──────────────
-- SMTP: reference/documentation only, deliberately no password column.
-- A browser app can never safely hold SMTP credentials — there's no backend
-- here to execute delivery. Real transport is configured directly in the
-- Supabase Dashboard (Authentication -> Emails -> SMTP Settings); this table
-- just records the operational details for the team, editable by Super Admin.
create table if not exists public.smtp_settings (
  id boolean primary key default true check (id),
  host text,
  port integer,
  username text,
  from_name text not null default 'PoultryHub',
  from_email text,
  reply_to text,
  encryption text not null default 'tls' check (encryption in ('none', 'ssl', 'tls')),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.smtp_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists set_smtp_settings_updated_at on public.smtp_settings;
create trigger set_smtp_settings_updated_at
  before update on public.smtp_settings
  for each row execute procedure public.handle_updated_at();

alter table public.smtp_settings enable row level security;

drop policy if exists "Super Admin can view smtp settings" on public.smtp_settings;
create policy "Super Admin can view smtp settings"
  on public.smtp_settings for select
  using (public.is_super_admin());

drop policy if exists "Super Admin can update smtp settings" on public.smtp_settings;
create policy "Super Admin can update smtp settings"
  on public.smtp_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Notification event toggles: one row per category that already has a real
-- trigger generating it. Each notify_*() function across this schema checks
-- its own category's flag here before inserting — an additive guard, no
-- other trigger logic changes. The 4 categories with no trigger yet
-- (system_update/security_alert/backup_completion/failed_login_attempt)
-- aren't included — a toggle for something nothing generates would be fake.
create table if not exists public.notification_settings (
  category text primary key check (category in (
    'new_user_registration', 'new_staff_account', 'mortality_alert', 'low_inventory',
    'low_egg_production', 'low_feed_stock', 'low_vitamin_stock', 'expiring_medicine'
  )),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.notification_settings (category) values
  ('new_user_registration'), ('new_staff_account'), ('mortality_alert'), ('low_inventory'),
  ('low_egg_production'), ('low_feed_stock'), ('low_vitamin_stock'), ('expiring_medicine')
on conflict (category) do nothing;

drop trigger if exists set_notification_settings_updated_at on public.notification_settings;
create trigger set_notification_settings_updated_at
  before update on public.notification_settings
  for each row execute procedure public.handle_updated_at();

alter table public.notification_settings enable row level security;

drop policy if exists "Super Admin can view notification settings" on public.notification_settings;
create policy "Super Admin can view notification settings"
  on public.notification_settings for select
  using (public.is_super_admin());

drop policy if exists "Super Admin can update notification settings" on public.notification_settings;
create policy "Super Admin can update notification settings"
  on public.notification_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Notification templates: default title/message for the 4 categories a
-- Farm Admin/Manager already composes by hand in SendNotificationDrawer.tsx.
-- Picking the category there pre-fills these — still freely editable before
-- sending, a real default rather than a lock. The 8 system-generated
-- categories keep their wording fixed in each module's own notify_*()
-- trigger function (shown read-only in the UI) — editing those would mean
-- rewriting already-shipped trigger logic, out of scope here.
create table if not exists public.notification_templates (
  category text primary key check (category in (
    'task_assignment', 'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder'
  )),
  title text not null default '',
  message text not null default '',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.notification_templates (category) values
  ('task_assignment'), ('feed_schedule_reminder'), ('vaccination_reminder'), ('production_reminder')
on conflict (category) do nothing;

drop trigger if exists set_notification_templates_updated_at on public.notification_templates;
create trigger set_notification_templates_updated_at
  before update on public.notification_templates
  for each row execute procedure public.handle_updated_at();

alter table public.notification_templates enable row level security;

drop policy if exists "Farm Admin, Manager, and Super Admin can view notification templates" on public.notification_templates;
create policy "Farm Admin, Manager, and Super Admin can view notification templates"
  on public.notification_templates for select
  using (public.is_super_admin() or public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Super Admin can update notification templates" on public.notification_templates;
create policy "Super Admin can update notification templates"
  on public.notification_templates for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_10_system_settings')
on conflict (version) do nothing;
