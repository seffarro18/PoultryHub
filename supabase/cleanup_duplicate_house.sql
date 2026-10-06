-- PoultryHub — one-off cleanup, NOT a schema migration.
--
-- Removes the stray "House_1" duplicate of "House 1" reported in the
-- Poultry Inventory dropdown. Verified directly against the live database
-- that this row (id 9e82ee8a-a719-4cfe-9a57-974c4f2157ee) has ZERO
-- references anywhere — poultry_inventory_events.from_house_id/to_house_id,
-- feed_distribution.house_id, egg_production.poultry_house_id,
-- mortality_records.poultry_house_id, profiles.assigned_poultry_house_id
-- all return 0 rows for it — so this is a safe delete, not a merge. If you
-- ever hit this situation again with a duplicate that DOES have
-- references, those would need reassigning to the canonical house's id
-- first; this script intentionally does not attempt that generically.

delete from public.poultry_houses
where id = '9e82ee8a-a719-4cfe-9a57-974c4f2157ee' and name = 'House_1';

select id, name from public.poultry_houses order by name;
