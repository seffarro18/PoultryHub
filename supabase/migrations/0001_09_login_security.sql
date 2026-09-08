-- PoultryHub — migration 0001_09: login security.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers
-- "login_history" plus the password-policy/lockout machinery it's paired
-- with in the original schema. Two categories from the original request
-- have nothing to split out here: "password_resets" and "two_factor_auth"
-- are both handled natively by Supabase Auth (resetPasswordForEmail,
-- auth.mfa.*) — this app never created its own tables for either. Note also
-- this file is NOT "user_sessions" (that's the Profile Module's own
-- device-session table, see 0001_12_profile_module.sql) — security_settings/
-- login_history/failed_login_attempts predate that module.
--
-- Depends on 0001_01_users_auth.sql. record_failed_login_attempt() inserts
-- into public.audit_logs, created in 0001_11_audit_logs.sql — safe forward
-- reference, same lazy-function-body reasoning noted throughout this file
-- set (audit_logs only needs to exist by the time this function actually
-- fires, not at CREATE FUNCTION time).

create table if not exists public.security_settings (
  id boolean primary key default true check (id),
  min_password_length int not null default 8 check (min_password_length >= 6),
  require_uppercase boolean not null default true,
  require_lowercase boolean not null default true,
  require_number boolean not null default true,
  require_symbol boolean not null default false,
  mfa_enabled boolean not null default false,
  session_timeout_minutes int not null default 60 check (session_timeout_minutes >= 5),
  max_failed_attempts int not null default 10 check (max_failed_attempts >= 3),
  lockout_duration_minutes int not null default 15 check (lockout_duration_minutes >= 1),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.security_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists set_security_settings_updated_at on public.security_settings;
create trigger set_security_settings_updated_at
  before update on public.security_settings
  for each row execute procedure public.handle_updated_at();

alter table public.security_settings enable row level security;

-- World-readable: these are just policy thresholds (not sensitive), and the
-- sign-up form and the pre-auth lockout check both need them before anyone
-- has a session.
drop policy if exists "Anyone can view security settings" on public.security_settings;
create policy "Anyone can view security settings"
  on public.security_settings for select
  using (true);

drop policy if exists "Super Admin can update security settings" on public.security_settings;
create policy "Super Admin can update security settings"
  on public.security_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── Login history ────────────────────────────────────────────────────────
-- One row per real sign-in this app observes (AuthContext inserts on
-- SIGNED_IN only, never on token refresh) — only sees logins that happened
-- through this app's own login form/OAuth flow, not any other client
-- hitting the Supabase project directly.

create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.login_history enable row level security;

drop policy if exists "Users can view their own login history" on public.login_history;
create policy "Users can view their own login history"
  on public.login_history for select
  using (user_id = auth.uid() or public.is_super_admin());

-- No update/delete policy at all — an audit log stays immutable by
-- construction, not by convention.
drop policy if exists "Users can record their own login" on public.login_history;
create policy "Users can record their own login"
  on public.login_history for insert
  with check (user_id = auth.uid());

create index if not exists login_history_user_id_idx on public.login_history (user_id);
create index if not exists login_history_created_at_idx on public.login_history (created_at);

-- ── Failed login attempts & lockout ─────────────────────────────────────
-- A failed sign-in has no session, so there's no auth.uid() to attach a log
-- row to — the only way to capture it at all is to let the login form
-- itself report the failure, which means the write must be reachable by an
-- unauthenticated (anon) caller. RLS is enabled with zero direct policies —
-- every access goes through the two security definer functions below (same
-- bypass reasoning as is_super_admin() etc.), so the actual writable/
-- readable surface is exactly those two narrow operations, never an open
-- table policy anyone could query or spam freely.
create table if not exists public.failed_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.failed_login_attempts enable row level security;

create index if not exists failed_login_attempts_email_idx on public.failed_login_attempts (email);
create index if not exists failed_login_attempts_created_at_idx on public.failed_login_attempts (created_at);

drop policy if exists "Super Admin can view failed login attempts" on public.failed_login_attempts;
create policy "Super Admin can view failed login attempts"
  on public.failed_login_attempts for select
  using (public.is_super_admin());

create or replace function public.record_failed_login_attempt(p_email text, p_user_agent text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_max_attempts int;
  v_recent_count int;
begin
  insert into public.failed_login_attempts (email, user_agent)
  values (lower(trim(p_email)), p_user_agent);

  -- No authenticated user exists yet at this point, so user_id/farm_id stay
  -- null — the attempted email is the only identifying context available,
  -- carried in the description instead.
  insert into public.audit_logs (module, action, description, severity, status, browser)
  values ('Authentication', 'failed_login', 'Failed sign-in attempt for ' || lower(trim(p_email)), 'warning', 'failure', p_user_agent);

  -- Reuses the exact threshold that already governs account lockout —
  -- "Multiple Failed Login Attempts" isn't a separately-invented number.
  select max_failed_attempts into v_max_attempts from public.security_settings where id = true;
  select count(*) into v_recent_count
  from public.failed_login_attempts
  where email = lower(trim(p_email)) and created_at >= now() - interval '1 hour';

  if v_recent_count >= v_max_attempts then
    insert into public.audit_logs (module, action, description, severity, status)
    values (
      'Authentication', 'multiple_failed_logins',
      'Multiple failed sign-in attempts for ' || lower(trim(p_email)) || ' — account temporarily locked.',
      'critical', 'failure'
    );
  end if;
end;
$$;

grant execute on function public.record_failed_login_attempt(text, text) to anon, authenticated;

-- Known, inherent trade-off (shared by basically every email-based lockout
-- scheme): since the anon key is public, anyone can call
-- record_failed_login_attempt for *any* email string, real or not — which
-- is exactly why max_failed_attempts/lockout_duration_minutes above default
-- to lenient values, not hair-trigger ones.
create or replace function public.check_login_allowed(p_email text)
returns table (allowed boolean, retry_after_seconds int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_max_attempts int;
  v_lockout_minutes int;
  v_recent_count int;
  v_oldest timestamptz;
begin
  select max_failed_attempts, lockout_duration_minutes
    into v_max_attempts, v_lockout_minutes
  from public.security_settings where id = true;

  select count(*), min(created_at) into v_recent_count, v_oldest
  from public.failed_login_attempts
  where email = lower(trim(p_email))
    and created_at >= now() - make_interval(mins => v_lockout_minutes);

  if v_recent_count >= v_max_attempts then
    return query select false, greatest(0, extract(epoch from (v_oldest + make_interval(mins => v_lockout_minutes) - now()))::int);
  else
    return query select true, 0;
  end if;
end;
$$;

grant execute on function public.check_login_allowed(text) to anon, authenticated;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_09_login_security')
on conflict (version) do nothing;
