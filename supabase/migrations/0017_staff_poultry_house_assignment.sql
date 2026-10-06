-- PoultryHub — migration 0017: Staff's "Assigned Poultry House/Pen" becomes
-- a real reference into poultry_houses (0015), instead of the free-text
-- profiles.assigned_house_pen column Staff Management currently exposes as
-- a plain text input (and which was showing raw values like "1" with no
-- link to an actual house/pen record).
--
-- assigned_house_pen (text) is kept, not dropped — same "add the FK
-- alongside, keep writing the text mirror" pattern 0015 already used for
-- egg_production.house_pen — so any other reader of the text column is
-- unaffected. Nothing else in this migration changes: Staff's own farm
-- scoping for read/write elsewhere is already covered by 0015's RLS on
-- poultry_houses itself and on egg_production.poultry_house_id.

alter table public.profiles add column if not exists assigned_poultry_house_id uuid references public.poultry_houses (id) on delete set null;

-- Re-issues prevent_self_privilege_escalation() (0001_01) in full — Postgres
-- functions are replaced wholesale, not patched — adding exactly two
-- things: (1) assigned_poultry_house_id joins assigned_house_pen in the
-- generic "only Super Admin/Farm Admin may change this" blocked-fields
-- list, and (2) inside the existing Farm-Admin-editing-their-own-Staff
-- carve-out, a farm-ownership check on the new column specifically — the
-- same "don't rely on frontend filtering alone" guarantee already applied
-- to egg_production.poultry_house_id in 0015, now covering the assignment
-- itself so a request can't reference another farm's house even if the UI
-- would never offer one.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if public.current_user_role() = 'Farm Admin' and old.role = 'Staff' then
    if new.role is distinct from old.role then
      raise exception 'Farm Admin cannot change a staff member''s role';
    end if;
    if new.farm_id is distinct from old.farm_id then
      if not (old.farm_id is null or old.farm_id = public.current_farm_id())
         or new.farm_id is distinct from public.current_farm_id() then
        raise exception 'Farm Admin can only assign staff into their own farm';
      end if;
    end if;
    if new.assigned_poultry_house_id is distinct from old.assigned_poultry_house_id
       and new.assigned_poultry_house_id is not null
       and not exists (
         select 1 from public.poultry_houses ph
         where ph.id = new.assigned_poultry_house_id and ph.farm_id = new.farm_id
       ) then
      raise exception 'Assigned poultry house must belong to the staff member''s own farm';
    end if;
    return new;
  end if;

  if (new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.farm_id is distinct from old.farm_id
      or new.assigned_house_pen is distinct from old.assigned_house_pen
      or new.assigned_poultry_house_id is distinct from old.assigned_poultry_house_id
      or new.position is distinct from old.position
      or new.employment_status is distinct from old.employment_status
      or new.employee_id is distinct from old.employee_id) then
    raise exception 'Only a Super Admin or your Farm Admin can change role, status, farm, or work assignment';
  end if;
  return new;
end;
$$;

insert into public.schema_migrations (version) values ('0017_staff_poultry_house_assignment')
on conflict (version) do nothing;
