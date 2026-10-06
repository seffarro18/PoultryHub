-- PoultryHub — migration 0023: Egg Production's Good Eggs breakdown, 4 -> 6 sizes.
--
-- Egg Pricing (0021) already configures prices for all 6 sizes (Peewee,
-- Small, Medium, Large, X Large, Jumbo), but Egg Production's Good Eggs
-- classification only ever tracked 4 (Small/Medium/Large/Jumbo) — meaning
-- Peewee/X Large had a configurable price but no real, trackable stock.
-- Adding the two missing size fields here closes that gap so every
-- configured price is actually sellable (see the new multi-item Sales
-- feature, 0024_sales_multi_item.sql, which validates stock per size).
--
-- Additive only, no backfill needed: existing rows' `good_eggs` total is
-- already the sum of the other 4 fields at the time they were entered, and
-- these two new columns default to 0 — they don't change that total.

alter table public.egg_production add column if not exists peewee_eggs int not null default 0 check (peewee_eggs >= 0);
alter table public.egg_production add column if not exists x_large_eggs int not null default 0 check (x_large_eggs >= 0);

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0023_egg_production_six_sizes')
on conflict (version) do nothing;
