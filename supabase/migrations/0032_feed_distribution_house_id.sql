-- PoultryHub — migration 0032: Feed Distribution's House/Pen becomes a real reference.
--
-- `feed_distribution.house_pen` has always been plain text (typed freely),
-- unlike poultry_inventory_events' from_house_id/to_house_id (0028) — same
-- "text column + optional id column" dual-reference pattern applied here so
-- the Record Feed Distribution form can bind a real PoultryHouseSelect
-- dropdown instead of a free-text input, without losing any existing
-- house_pen string on old rows (never backfilled, never required).
--
-- Depends on 0001_05_feeds_vitamins.sql (feed_distribution), 0015_poultry_houses.sql (poultry_houses).

alter table public.feed_distribution add column if not exists house_id uuid references public.poultry_houses (id) on delete set null;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0032_feed_distribution_house_id')
on conflict (version) do nothing;
