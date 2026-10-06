-- PoultryHub — migration 0037: add 'culling' to the poultry_event_type enum.
--
-- MUST be pasted and run ON ITS OWN, as a separate SQL Editor execution from
-- 0038 — PostgreSQL does not allow a new enum value added via
-- `ALTER TYPE ... ADD VALUE` to be referenced (in a check constraint,
-- insert, etc.) within the same multi-statement batch/transaction that
-- added it. Running this file alone first, letting it commit, then running
-- 0038 separately avoids that restriction entirely.
--
-- Depends on 0001_04_poultry_inventory.sql (poultry_event_type).

alter type public.poultry_event_type add value if not exists 'culling';

insert into public.schema_migrations (version) values ('0037_poultry_culling_event_type')
on conflict (version) do nothing;
