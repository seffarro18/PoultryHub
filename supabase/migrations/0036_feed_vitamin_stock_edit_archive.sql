-- PoultryHub — migration 0036: Farm Admin can correct or archive a Feed/
-- Vitamin stock batch, with a real audit trail and no hard delete.
--
-- Reuses existing architecture throughout, per this feature's own explicit
-- "do not create duplicate systems" instruction:
--   - History is NOT a new table — it's the existing audit_logs system
--     (log_audit_event(), already firing on every feeds/vitamins
--     insert/update and storing full before/after row snapshots in
--     old_value/new_value jsonb). This migration only teaches that one
--     shared function to label archive/restore distinctly from a plain
--     edit, using the nested-IF-safe pattern fixed in 0035 (never combine
--     a TG_TABLE_NAME check with a new./old. column reference in one
--     boolean expression — see 0035's header for why that crashes).
--   - Soft delete is a new archived_at/archived_by pair of columns, not a
--     parallel table. A deleted batch is simply excluded from every active
--     query via RLS (not just client-side filtering), while its full
--     history (including the delete itself) stays in audit_logs and its
--     feed_distribution/vitamin_administration foreign keys stay intact.
--   - Editing a batch is a correction to physical stock on hand, never a
--     rewrite of the original purchase_items/expenses rows — those stay
--     exactly as recorded at purchase time (see the "price/payment are
--     purchase-only, not edited here" comments already in the two form
--     drawers). This migration doesn't touch purchase_transactions,
--     purchase_items, or expenses at all.
--
-- Depends on 0001_05_feeds_vitamins.sql (feeds, vitamins),
-- 0001_11_audit_logs.sql / 0035 (log_audit_event),
-- 0029_inventory_purchases.sql (package_size on feeds).

-- ── 1. Soft-delete columns ────────────────────────────────────────────────

alter table public.feeds add column if not exists archived_at timestamptz;
alter table public.feeds add column if not exists archived_by uuid references public.profiles (id) on delete set null;
alter table public.vitamins add column if not exists archived_at timestamptz;
alter table public.vitamins add column if not exists archived_by uuid references public.profiles (id) on delete set null;

create index if not exists feeds_archived_at_idx on public.feeds (archived_at);
create index if not exists vitamins_archived_at_idx on public.vitamins (archived_at);

-- ── 2. RLS: active-only SELECT for farm roles, no DELETE policy at all ───
--
-- Splitting the old "for all" policy into select/insert/update (no delete)
-- is what actually makes "no hard delete" a database guarantee rather than
-- an app-only convention — with RLS enabled and no permissive DELETE
-- policy, a direct `delete from feeds` is denied for every non-superuser
-- role, regardless of what the client code does. Archiving always goes
-- through archive_feed_batch() below (security definer, bypasses RLS to
-- write archived_at itself), so Farm Admin/Manager never need table-level
-- DELETE in the first place.
--
-- The "active-only" SELECT restriction also means a History view can't
-- accidentally be built by querying `feeds` directly — archived rows are
-- only ever visible through audit_logs' preserved old_value/new_value
-- snapshots, which is exactly what section 12 of this feature's spec asks
-- for ("must not remain available... exists only as historical
-- information").

drop policy if exists "Farm Admin or Manager can manage their farm's feeds" on public.feeds;
create policy "Farm Admin or Manager can view their farm's active feeds"
  on public.feeds for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager') and archived_at is null);
create policy "Farm Admin or Manager can insert their farm's feeds"
  on public.feeds for insert
  with check (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));
create policy "Farm Admin or Manager can update their farm's feeds"
  on public.feeds for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Staff can view their farm's feeds" on public.feeds;
create policy "Staff can view their farm's active feeds"
  on public.feeds for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff' and archived_at is null);

drop policy if exists "Farm Admin or Manager can manage their farm's vitamins" on public.vitamins;
create policy "Farm Admin or Manager can view their farm's active vitamins"
  on public.vitamins for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager') and archived_at is null);
create policy "Farm Admin or Manager can insert their farm's vitamins"
  on public.vitamins for insert
  with check (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));
create policy "Farm Admin or Manager can update their farm's vitamins"
  on public.vitamins for update
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Staff can view their farm's vitamins" on public.vitamins;
create policy "Staff can view their farm's active vitamins"
  on public.vitamins for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff' and archived_at is null);

-- ── 3. update_feed_batch(): correct quantity/category/brand/packaging/dates,
--       never below what's already been distributed ─────────────────────

create or replace function public.update_feed_batch(
  p_id uuid,
  p_category text,
  p_brand text,
  p_quantity numeric,
  p_package_size text,
  p_purchase_date date,
  p_expiration_date date,
  p_remarks text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_id uuid;
  v_quantity numeric;
  v_remaining numeric;
  v_unit text;
  v_archived_at timestamptz;
  v_used numeric;
begin
  if public.current_user_role() not in ('Farm Admin', 'Manager') then
    raise exception 'Not authorized to edit feed stock';
  end if;

  select farm_id, quantity, remaining_stock, unit, archived_at
    into v_farm_id, v_quantity, v_remaining, v_unit, v_archived_at
    from public.feeds where id = p_id;

  if v_farm_id is null then
    raise exception 'Feed batch not found';
  end if;
  if v_farm_id is distinct from public.current_farm_id() then
    raise exception 'Not authorized to edit this farm''s feed stock';
  end if;
  if v_archived_at is not null then
    raise exception 'Cannot edit an archived stock record. Restore it first.';
  end if;
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  v_used := v_quantity - v_remaining;
  if p_quantity < v_used then
    raise exception 'Cannot reduce this stock below the quantity already used. Quantity already used: % %.', v_used, v_unit;
  end if;

  -- Keeps feed_name in sync with brand/category — it's derived at purchase
  -- time ("{brand} {category} Feed") and never freely editable itself, so a
  -- Brand/Category correction must re-derive it or the two would silently
  -- drift apart.
  update public.feeds set
    category = p_category,
    brand = p_brand,
    feed_name = trim(both ' ' from coalesce(p_brand, '') || ' ' || coalesce(p_category, '') || ' Feed'),
    quantity = p_quantity,
    remaining_stock = p_quantity - v_used,
    package_size = p_package_size,
    purchase_date = p_purchase_date,
    expiration_date = p_expiration_date,
    remarks = p_remarks
  where id = p_id;
end;
$$;

revoke execute on function public.update_feed_batch(uuid, text, text, numeric, text, date, date, text) from public;
grant execute on function public.update_feed_batch(uuid, text, text, numeric, text, date, date, text) to authenticated;

-- ── 4. archive_feed_batch() / restore_feed_batch() ───────────────────────

create or replace function public.archive_feed_batch(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_id uuid;
  v_archived_at timestamptz;
begin
  if public.current_user_role() not in ('Farm Admin', 'Manager') then
    raise exception 'Not authorized to archive feed stock';
  end if;

  select farm_id, archived_at into v_farm_id, v_archived_at from public.feeds where id = p_id;
  if v_farm_id is null then
    raise exception 'Feed batch not found';
  end if;
  if v_farm_id is distinct from public.current_farm_id() then
    raise exception 'Not authorized to archive this farm''s feed stock';
  end if;
  if v_archived_at is not null then
    return;
  end if;

  update public.feeds set archived_at = now(), archived_by = auth.uid() where id = p_id;
end;
$$;

revoke execute on function public.archive_feed_batch(uuid) from public;
grant execute on function public.archive_feed_batch(uuid) to authenticated;

create or replace function public.restore_feed_batch(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_id uuid;
begin
  if public.current_user_role() not in ('Farm Admin', 'Manager') then
    raise exception 'Not authorized to restore feed stock';
  end if;

  select farm_id into v_farm_id from public.feeds where id = p_id;
  if v_farm_id is null then
    raise exception 'Feed batch not found';
  end if;
  if v_farm_id is distinct from public.current_farm_id() then
    raise exception 'Not authorized to restore this farm''s feed stock';
  end if;

  update public.feeds set archived_at = null, archived_by = null where id = p_id;
end;
$$;

revoke execute on function public.restore_feed_batch(uuid) from public;
grant execute on function public.restore_feed_batch(uuid) to authenticated;

-- ── 5. Same three for vitamins ───────────────────────────────────────────

create or replace function public.update_vitamin_batch(
  p_id uuid,
  p_vitamin_name text,
  p_vitamin_type text,
  p_category text,
  p_quantity numeric,
  p_unit text,
  p_package_size text,
  p_purchase_date date,
  p_expiration_date date,
  p_remarks text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_id uuid;
  v_quantity numeric;
  v_remaining numeric;
  v_current_unit text;
  v_archived_at timestamptz;
  v_used numeric;
begin
  if public.current_user_role() not in ('Farm Admin', 'Manager') then
    raise exception 'Not authorized to edit vitamin stock';
  end if;

  select farm_id, quantity, remaining_stock, unit, archived_at
    into v_farm_id, v_quantity, v_remaining, v_current_unit, v_archived_at
    from public.vitamins where id = p_id;

  if v_farm_id is null then
    raise exception 'Vitamin batch not found';
  end if;
  if v_farm_id is distinct from public.current_farm_id() then
    raise exception 'Not authorized to edit this farm''s vitamin stock';
  end if;
  if v_archived_at is not null then
    raise exception 'Cannot edit an archived stock record. Restore it first.';
  end if;
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  v_used := v_quantity - v_remaining;
  if p_quantity < v_used then
    raise exception 'Cannot reduce this stock below the quantity already used. Quantity already used: % %.', v_used, v_current_unit;
  end if;

  update public.vitamins set
    vitamin_name = p_vitamin_name,
    vitamin_type = p_vitamin_type,
    category = p_category,
    quantity = p_quantity,
    unit = p_unit,
    remaining_stock = p_quantity - v_used,
    package_size = p_package_size,
    purchase_date = p_purchase_date,
    expiration_date = p_expiration_date,
    remarks = p_remarks
  where id = p_id;
end;
$$;

revoke execute on function public.update_vitamin_batch(uuid, text, text, text, numeric, text, text, date, date, text) from public;
grant execute on function public.update_vitamin_batch(uuid, text, text, text, numeric, text, text, date, date, text) to authenticated;

create or replace function public.archive_vitamin_batch(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_id uuid;
  v_archived_at timestamptz;
begin
  if public.current_user_role() not in ('Farm Admin', 'Manager') then
    raise exception 'Not authorized to archive vitamin stock';
  end if;

  select farm_id, archived_at into v_farm_id, v_archived_at from public.vitamins where id = p_id;
  if v_farm_id is null then
    raise exception 'Vitamin batch not found';
  end if;
  if v_farm_id is distinct from public.current_farm_id() then
    raise exception 'Not authorized to archive this farm''s vitamin stock';
  end if;
  if v_archived_at is not null then
    return;
  end if;

  update public.vitamins set archived_at = now(), archived_by = auth.uid() where id = p_id;
end;
$$;

revoke execute on function public.archive_vitamin_batch(uuid) from public;
grant execute on function public.archive_vitamin_batch(uuid) to authenticated;

create or replace function public.restore_vitamin_batch(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_id uuid;
begin
  if public.current_user_role() not in ('Farm Admin', 'Manager') then
    raise exception 'Not authorized to restore vitamin stock';
  end if;

  select farm_id into v_farm_id from public.vitamins where id = p_id;
  if v_farm_id is null then
    raise exception 'Vitamin batch not found';
  end if;
  if v_farm_id is distinct from public.current_farm_id() then
    raise exception 'Not authorized to restore this farm''s vitamin stock';
  end if;

  update public.vitamins set archived_at = null, archived_by = null where id = p_id;
end;
$$;

revoke execute on function public.restore_vitamin_batch(uuid) from public;
grant execute on function public.restore_vitamin_batch(uuid) to authenticated;

-- ── 6. log_audit_event(): distinguish archive/restore from a plain edit ──
-- Same function 0035 already fixed — only the 'feeds'/'vitamins' UPDATE
-- branches change here (nested, not combined with TG_TABLE_NAME via AND,
-- consistent with 0035's fix).

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_row record;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_user_role public.user_role;
  v_farm_id uuid;
  v_farm_name text;
  v_record_id uuid;
  v_module text;
  v_action text;
  v_severity text := 'info';
  v_description text;
begin
  if TG_OP = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  select name, role into v_user_name, v_user_role from public.profiles where id = v_user_id;

  v_module := case TG_TABLE_NAME
    when 'farms' then 'Farm Management'
    when 'profiles' then 'User Management'
    when 'egg_production' then 'Egg Production'
    when 'poultry_inventory_events' then 'Poultry Inventory'
    when 'feeds' then 'Feeds & Vitamins'
    when 'vitamins' then 'Feeds & Vitamins'
    when 'feed_distribution' then 'Feeds & Vitamins'
    when 'vitamin_administration' then 'Feeds & Vitamins'
    when 'health_records' then 'Health Records'
    when 'mortality_records' then 'Mortality Records'
    when 'notifications' then 'Notifications'
    when 'system_settings' then 'System Settings'
    when 'smtp_settings' then 'System Settings'
    when 'notification_settings' then 'System Settings'
    when 'notification_templates' then 'System Settings'
    when 'sales' then 'Sales & Expenses'
    when 'expenses' then 'Sales & Expenses'
    when 'tasks' then 'Tasks'
    else TG_TABLE_NAME
  end;

  if TG_TABLE_NAME = 'farms' then
    v_farm_id := v_row.id;
    v_farm_name := v_row.name;
  elsif TG_TABLE_NAME in ('system_settings', 'smtp_settings', 'notification_settings', 'notification_templates') then
    v_farm_id := null;
  else
    v_farm_id := v_row.farm_id;
  end if;

  if v_farm_id is not null and v_farm_name is null then
    select name into v_farm_name from public.farms where id = v_farm_id;
  end if;

  if TG_TABLE_NAME in ('system_settings', 'smtp_settings', 'notification_settings', 'notification_templates') then
    v_record_id := null;
  else
    v_record_id := v_row.id;
  end if;

  if TG_OP = 'DELETE' then
    v_action := case TG_TABLE_NAME
      when 'profiles' then 'user_deleted'
      when 'farms' then 'farm_deleted'
      else TG_TABLE_NAME || '_deleted'
    end;
    v_severity := case TG_TABLE_NAME when 'profiles' then 'critical' when 'farms' then 'critical' else 'high' end;
  elsif TG_OP = 'INSERT' then
    if TG_TABLE_NAME = 'farms' then
      v_action := 'farm_registered'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'profiles' then
      v_action := 'user_created'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'notifications' then
      if new.created_by is null then
        return new;
      end if;
      v_action := 'notification_sent'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'feeds' then
      v_action := 'feed_stock_added'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'vitamins' then
      v_action := 'vitamin_stock_added'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'sales' then
      v_action := 'sale_recorded'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'expenses' then
      v_action := 'expense_recorded'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'tasks' then
      v_action := 'task_created'; v_severity := 'info';
    else
      v_action := TG_TABLE_NAME || '_recorded'; v_severity := 'info';
    end if;
  else -- UPDATE
    if TG_TABLE_NAME = 'profiles' then
      if new.status = 'disabled' and old.status is distinct from 'disabled' then
        v_action := 'user_deactivated'; v_severity := 'high';
      elsif new.status = 'active' and old.status is distinct from 'active' then
        v_action := 'user_activated'; v_severity := 'info';
      elsif new.role is distinct from old.role then
        v_action := 'role_changed'; v_severity := 'high';
      elsif new.farm_id is distinct from old.farm_id and new.farm_id is not null then
        v_action := 'staff_assigned'; v_severity := 'info';
      else
        v_action := 'user_updated'; v_severity := 'info';
      end if;
    elsif TG_TABLE_NAME = 'farms' then
      v_action := 'farm_updated'; v_severity := 'high';
    elsif TG_TABLE_NAME in ('egg_production', 'feed_distribution', 'vitamin_administration', 'health_records', 'mortality_records') then
      if new.status is distinct from old.status then
        v_action := new.status::text;
        v_severity := case new.status::text when 'rejected' then 'warning' else 'info' end;
      else
        v_action := TG_TABLE_NAME || '_updated'; v_severity := 'info';
      end if;
    elsif TG_TABLE_NAME = 'tasks' then
      if new.status is distinct from old.status then
        v_action := new.status::text;
        v_severity := case new.status::text when 'blocked' then 'warning' else 'info' end;
      else
        v_action := TG_TABLE_NAME || '_updated'; v_severity := 'info';
      end if;
    elsif TG_TABLE_NAME = 'feeds' then
      if new.archived_at is distinct from old.archived_at then
        if new.archived_at is not null then
          v_action := 'feed_stock_archived'; v_severity := 'warning';
        else
          v_action := 'feed_stock_restored'; v_severity := 'info';
        end if;
      else
        v_action := 'feed_stock_updated'; v_severity := 'info';
      end if;
    elsif TG_TABLE_NAME = 'vitamins' then
      if new.archived_at is distinct from old.archived_at then
        if new.archived_at is not null then
          v_action := 'vitamin_stock_archived'; v_severity := 'warning';
        else
          v_action := 'vitamin_stock_restored'; v_severity := 'info';
        end if;
      else
        v_action := 'vitamin_stock_updated'; v_severity := 'info';
      end if;
    elsif TG_TABLE_NAME in ('system_settings', 'smtp_settings', 'notification_settings', 'notification_templates') then
      v_action := 'system_settings_updated'; v_severity := 'critical';
    elsif TG_TABLE_NAME = 'sales' then
      v_action := 'sale_updated'; v_severity := 'info';
    elsif TG_TABLE_NAME = 'expenses' then
      v_action := 'expense_updated'; v_severity := 'info';
    else
      v_action := TG_TABLE_NAME || '_updated'; v_severity := 'info';
    end if;
  end if;

  v_description := v_module || ': ' || replace(v_action, '_', ' ');

  insert into public.audit_logs (
    user_id, user_name, user_role, farm_id, farm_name, module, action, description,
    table_name, record_id, old_value, new_value, severity, status
  )
  values (
    v_user_id, v_user_name, v_user_role, v_farm_id, v_farm_name, v_module, v_action, v_description,
    TG_TABLE_NAME, v_record_id,
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end,
    v_severity, 'success'
  );

  return v_row;
end;
$$;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0036_feed_vitamin_stock_edit_archive')
on conflict (version) do nothing;
