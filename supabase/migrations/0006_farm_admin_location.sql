-- PoultryHub — migration 0006: Farm Admin can set their own farm's location.
--
-- Lets the mobile app's new "Use My Current Location" feature actually save
-- — until now latitude/longitude were Super-Admin-only, same as every other
-- farm field. Re-ships prevent_farm_field_overreach() (0001_02) with just
-- those two columns removed from the blocked list; every other guarded
-- field (name/owner/address/region/province/city/contact_number/email/
-- farm_type/capacity/status/farm_code) is unchanged. No RLS policy change
-- needed — "Farm Admin can update their own farm's staff permissions"
-- (0001_02) already permits Farm Admin to UPDATE their own farm row at the
-- row level; this trigger is the only thing blocking these two columns.
--
-- Scoped to Farm Admin only, matching the feature's own spec and this
-- existing policy's scope — Manager has no farms UPDATE policy at all
-- today and this migration doesn't add one.
--
-- Depends on 0001_02 (farms, prevent_farm_field_overreach).

create or replace function public.prevent_farm_field_overreach()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if public.current_user_role() = 'Farm Admin' and old.id = public.current_farm_id() then
    if new.name is distinct from old.name
       or new.owner is distinct from old.owner
       or new.address is distinct from old.address
       or new.region is distinct from old.region
       or new.province is distinct from old.province
       or new.city is distinct from old.city
       or new.contact_number is distinct from old.contact_number
       or new.email is distinct from old.email
       or new.farm_type is distinct from old.farm_type
       or new.capacity is distinct from old.capacity
       or new.status is distinct from old.status
       or new.farm_code is distinct from old.farm_code then
      raise exception 'Only a Super Admin can update farm information';
    end if;
    return new;
  end if;

  raise exception 'Only a Super Admin can update farm records';
end;
$$;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0006_farm_admin_location')
on conflict (version) do nothing;
