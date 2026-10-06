-- PoultryHub — migration 0013: egg size classification + merged
-- damaged/cracked field + generated expected_eggs.
--
-- Reworks the egg_production quality breakdown: good_eggs is now backed by
-- four size columns (small/medium/large/jumbo) that Staff enters directly;
-- cracked_eggs and damaged_eggs are merged into one damaged_cracked_eggs
-- column. eggs_collected and good_eggs remain real, independently-writable
-- columns (not generated) — the client computes and writes them, exactly
-- like the eggs_collected-is-computed-client-side fix already in place, so
-- this migration adds no new DB-level validation/trigger for the
-- size-sum-equals-good_eggs or good+damaged-equals-collected invariants.
-- expected_eggs IS a generated column: it's a pure, always-true-by-
-- definition function of layer_count (× 30) with no historical baggage to
-- preserve, unlike good_eggs/eggs_collected.
--
-- Old cracked_eggs/damaged_eggs columns are left in place, unused, rather
-- than dropped — cheaper to reverse, no data loss, consistent with this
-- project's migration discipline (additive over destructive).

-- Defensive cleanup: drop the enforce_egg_production_totals trigger/function
-- from the earlier (deleted, never-applied-as-far-as-known) migration, in
-- case it was ever pasted into Supabase before being deleted locally. If it
-- were still live, it would check eggs_collected against the now-unused
-- cracked_eggs/damaged_eggs columns (both staying 0 going forward) and
-- reject every future insert that has any damaged_cracked_eggs. drop ...
-- if exists is always safe regardless of whether it was ever actually
-- applied.
drop trigger if exists enforce_egg_production_totals_trigger on public.egg_production;
drop function if exists public.enforce_egg_production_totals();

alter table public.egg_production add column if not exists small_eggs int not null default 0 check (small_eggs >= 0);
alter table public.egg_production add column if not exists medium_eggs int not null default 0 check (medium_eggs >= 0);
alter table public.egg_production add column if not exists large_eggs int not null default 0 check (large_eggs >= 0);
alter table public.egg_production add column if not exists jumbo_eggs int not null default 0 check (jumbo_eggs >= 0);

alter table public.egg_production add column if not exists damaged_cracked_eggs int not null default 0 check (damaged_cracked_eggs >= 0);

-- One-time backfill: safe, additive, exact (cracked_eggs + damaged_eggs is
-- known for every existing row). Only touches rows where the merged column
-- is still at its just-added default of 0, so this block is itself
-- re-run-safe if the migration file is pasted more than once.
update public.egg_production
set damaged_cracked_eggs = cracked_eggs + damaged_eggs
where damaged_cracked_eggs = 0 and (cracked_eggs > 0 or damaged_eggs > 0);

-- expected_eggs: deterministic from layer_count, never manually entered or
-- overridden — a generated column is the correct fit (unlike good_eggs/
-- eggs_collected, there is no historical value to preserve here; every old
-- row gets a correct expected_eggs for free, computed from its own
-- layer_count).
alter table public.egg_production add column if not exists expected_eggs int
  generated always as (layer_count * 30) stored;

-- No CHECK constraint and no trigger enforcing small+medium+large+jumbo =
-- good_eggs, or good_eggs + damaged_cracked_eggs = eggs_collected. Both
-- totals are computed client-side and written as plain columns, the same
-- pattern already used for eggs_collected — see EggProductionFormDrawer.tsx.
-- Historical rows (small/medium/large/jumbo all 0) are expected and fine:
-- there is no historical size-breakdown data to backfill from.

insert into public.schema_migrations (version) values ('0013_egg_size_classification')
on conflict (version) do nothing;
