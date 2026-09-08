-- PoultryHub — migration 0007: daily egg-collection reminder preference.
--
-- Per-user opt-in for the mobile app's local (on-device) daily reminder
-- notification — same table/pattern as the existing theme/language
-- preferences. Purely a preference flag; the actual scheduling happens
-- entirely on-device via @capacitor/local-notifications, nothing server-side
-- triggers it.
--
-- Depends on 0001_12 (user_preferences).

alter table public.user_preferences add column if not exists egg_reminder_enabled boolean not null default false;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0007_egg_reminder_preference')
on conflict (version) do nothing;
