-- PoultryHub — migration 0001_12: profile module.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers the
-- "user_sessions" and "user_preferences" categories, plus the profile name
-- split and the avatar upload bucket that ship alongside them — everything
-- ProfilePage.tsx added on top of the base `profiles` row from
-- 0001_01_users_auth.sql.
--
-- Does NOT redefine prevent_self_privilege_escalation() — its final,
-- combined form (guarding both the original role/status/farm_id fields and
-- the HR fields added by the Staff Management module) already lives in
-- 0001_01_users_auth.sql, since it has to exist before the trigger that
-- uses it fires on the very first profiles UPDATE. Nothing left to add here.
--
-- Depends on 0001_01_users_auth.sql.

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists middle_name text;
alter table public.profiles add column if not exists last_name text;

-- ── Device sessions ──────────────────────────────────────────────────────
-- One row per device the user has signed in from (upserted on device_id, not
-- appended per sign-in) — this is "Manage Devices," not a login log. That's
-- login_history's job (0001_09_login_security.sql), a separate, append-only,
-- immutable table.
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null,
  device text not null,
  browser text not null,
  operating_system text not null,
  last_activity timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);

alter table public.user_sessions enable row level security;

drop policy if exists "Users can manage their own sessions" on public.user_sessions;
create policy "Users can manage their own sessions"
  on public.user_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists user_sessions_user_id_idx on public.user_sessions (user_id);

-- ── Preferences ──────────────────────────────────────────────────────────
-- Split into two tables on purpose: `theme` is a single always-present value
-- (primary key is user_id itself, one row always exists per user once set),
-- while notification preferences are an open, per-category on/off set (one
-- row per category the user has an opinion on) — a single wide table with
-- one boolean column per category would need a migration every time a new
-- notification category is added; this shape doesn't.
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "Users can manage their own preferences" on public.user_preferences;
create policy "Users can manage their own preferences"
  on public.user_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure public.handle_updated_at();

create table if not exists public.user_notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.user_notification_preferences enable row level security;

drop policy if exists "Users can manage their own notification preferences" on public.user_notification_preferences;
create policy "Users can manage their own notification preferences"
  on public.user_notification_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Avatar storage ───────────────────────────────────────────────────────
-- Public bucket (avatars are meant to be widely visible, e.g. in headers/
-- staff lists) with per-user write scoping via the storage path convention
-- `<user_id>/<filename>` — (storage.foldername(name))[1] pulls the first
-- path segment, the same pattern the mortality-photos/system-assets buckets
-- use for their own ownership checks.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_12_profile_module')
on conflict (version) do nothing;
