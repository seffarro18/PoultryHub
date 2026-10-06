-- PoultryHub — migration 0005: support email.
--
-- Super-Admin-configurable contact address for the farm-side app's "Report a
-- Problem" mailto: link (Help & Support). No CHECK constraint, matching
-- system_settings' other free-text fields — validated client-side only.
--
-- Depends on 0001_10 (system_settings).

alter table public.system_settings add column if not exists support_email text;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0005_support_email')
on conflict (version) do nothing;
