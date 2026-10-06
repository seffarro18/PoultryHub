-- PoultryHub — migration 0028: poultry_inventory_events House/Pen ids.
--
-- `from_house_pen`/`to_house_pen` (0001_04_poultry_inventory.sql) have always
-- been plain text — there was no id alongside them for the Record Inventory
-- Event form's House/Pen dropdown to be a real controlled component against
-- (it had nothing but a name string to bind its `value` to, which is what
-- made the dropdown appear to not work: its controlled value could never
-- reflect what was actually selected). Adding `from_house_id`/`to_house_id`
-- closes that gap — exactly the same "text column kept for display, real id
-- column added for the control to bind to" pattern egg_production already
-- uses (house_pen text + poultry_house_id uuid).
--
-- Nullable, no backfill: historical rows keep showing their existing
-- from_house_pen/to_house_pen text untouched; only new/edited rows get a
-- real id from here on.
--
-- Depends on 0001_04_poultry_inventory.sql (poultry_inventory_events),
-- 0015_poultry_houses.sql (poultry_houses).

alter table public.poultry_inventory_events add column if not exists from_house_id uuid references public.poultry_houses (id) on delete set null;
alter table public.poultry_inventory_events add column if not exists to_house_id uuid references public.poultry_houses (id) on delete set null;

create index if not exists poultry_inventory_events_from_house_id_idx on public.poultry_inventory_events (from_house_id);
create index if not exists poultry_inventory_events_to_house_id_idx on public.poultry_inventory_events (to_house_id);

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0028_poultry_event_house_ids')
on conflict (version) do nothing;
