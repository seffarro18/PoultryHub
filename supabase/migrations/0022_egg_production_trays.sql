-- PoultryHub — migration 0022: Egg Collection Record's "layers" -> "trays".
--
-- The Egg Collection Record's per-record layer_count/expected_eggs pair
-- (layer_count = ceil(good_eggs / 30), expected_eggs = layer_count * 30,
-- from 0001_03_egg_production.sql/0013_egg_size_classification.sql) is
-- replaced with a single number_of_trays field = good_eggs / 30, NOT
-- rounded — 70 good eggs is 2.33 trays, not 3. "Eggs per tray" is always
-- the constant 30, so there's nothing left to store for it; the old
-- generated expected_eggs column (which just reconstructed layer_count * 30,
-- circular since layer_count was itself derived from good_eggs) is dropped
-- outright rather than kept around unused.
--
-- This does NOT touch the "layers" poultry inventory concept elsewhere in
-- the schema (poultry_inventory_events.bird_type = 'Layer', etc.) — that's
-- a real, independently-tracked bird count and is untouched. Only this
-- egg-collection-record field, which was always just a derived stand-in
-- for good_eggs, is renamed.
--
-- Renaming layer_count carries its generated-column dependent (expected_eggs)
-- and its NOT NULL/default along automatically (Postgres tracks column
-- references by attnum, not by name), so this is safe to run even though
-- expected_eggs' expression still says "layer_count" in the file that
-- created it.

alter table public.egg_production drop column if exists expected_eggs;

alter table public.egg_production rename column layer_count to number_of_trays;
alter table public.egg_production alter column number_of_trays type numeric using number_of_trays::numeric;
alter table public.egg_production alter column number_of_trays set default 0;

alter table public.egg_production drop constraint if exists egg_production_layer_count_check;
alter table public.egg_production drop constraint if exists egg_production_number_of_trays_check;
alter table public.egg_production add constraint egg_production_number_of_trays_check check (number_of_trays >= 0);

-- Backfill: every existing row's number_of_trays was stored under the old
-- ceil(good_eggs / 30) formula — recompute it under the new, unrounded one
-- so historical records display consistently with new ones.
update public.egg_production set number_of_trays = good_eggs::numeric / 30;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0022_egg_production_trays')
on conflict (version) do nothing;
