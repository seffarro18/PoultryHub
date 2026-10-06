-- PoultryHub — migration 0040: Layer age as a numeric week count
--
-- Replaces poultry_inventory_events.age_label (free-text, e.g. "6 weeks")
-- with age_weeks (integer, 1-100) so age can be calculated/filtered/sorted
-- instead of parsed out of arbitrary text.
--
-- Confirmed live before writing this file that age_label has zero non-null
-- rows in production — this is a straight column swap, not a backfill, and
-- no historical data is lost. age_label is dropped rather than kept
-- alongside the new column (unlike, say, sales.quantity in 0024) because
-- this feature calls for exactly one age field, not two competing
-- representations of the same concept.

alter table public.poultry_inventory_events drop column if exists age_label;
alter table public.poultry_inventory_events add column if not exists age_weeks int;
alter table public.poultry_inventory_events drop constraint if exists poultry_inventory_events_age_weeks_check;
alter table public.poultry_inventory_events add constraint poultry_inventory_events_age_weeks_check
  check (age_weeks is null or (age_weeks >= 1 and age_weeks <= 100));

insert into public.schema_migrations (version) values ('0040_poultry_event_age_weeks')
on conflict (version) do nothing;
