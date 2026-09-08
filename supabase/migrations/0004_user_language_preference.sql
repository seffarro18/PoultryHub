-- PoultryHub — migration 0004: per-user language preference.
--
-- Adds a per-user language preference alongside the existing per-user theme
-- (user_preferences.theme) — same table, same pattern. Reuses the same
-- locale values as system_settings.language (English US/UK, Filipino) and
-- has the same real, narrow effect: date/number formatting only (via
-- Intl.DateTimeFormat), never UI text translation — this app has no
-- translation infrastructure. No check constraint, matching
-- system_settings.language's own definition (0001_10) — keeps adding a new
-- language option a pure app-code change, no migration required.
--
-- Depends on 0001_12 (user_preferences).

alter table public.user_preferences add column if not exists language text not null default 'en-US';

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0004_user_language_preference')
on conflict (version) do nothing;
