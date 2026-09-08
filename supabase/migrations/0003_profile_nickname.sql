-- PoultryHub — migration 0003: farm-side profile nickname.
--
-- Farm Admin/Manager/Staff's own Profile page replaces the First/Middle/Last
-- Name fields with a single Nickname field (Super Admin's own profile page
-- is unchanged, still uses first_name/middle_name/last_name). No RLS/trigger
-- changes needed — the existing "Users can view/update their own profile"
-- policy already covers any column on profiles, and
-- prevent_self_privilege_escalation() only guards specific listed fields
-- (role/status/farm/HR fields), so a new column is unrestricted by default.
--
-- Depends on 0001_01 (profiles).

alter table public.profiles add column if not exists nickname text;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0003_profile_nickname')
on conflict (version) do nothing;
