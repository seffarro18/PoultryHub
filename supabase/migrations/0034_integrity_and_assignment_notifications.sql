-- PoultryHub — migration 0034: closes three gaps found by the full
-- database connection/transaction/realtime audit.
--
-- 1. Feed/Vitamin Distribution had no stock check at INSERT time — only
--    apply_feed_stock_delta()/apply_vitamin_stock_delta() validated it, and
--    only on the pending -> approved UPDATE. A Staff-submitted pending row
--    with quantity_used far exceeding remaining_stock was accepted
--    silently and only surfaced as a failure later, when a Farm Admin tried
--    to approve it. New BEFORE INSERT OR UPDATE triggers validate against
--    current remaining_stock immediately, for any row not yet approved —
--    the approval-time check in apply_*_stock_delta() stays as-is (it's
--    still the sole authority over actually mutating remaining_stock).
--
-- 2. record_feed_purchase()/record_vitamin_purchase() had no protection
--    against a double-submitted purchase beyond the client's own
--    disabled={saving} button state — a races or lagging double-click could
--    create two identical purchases (inventory double-counted, expense
--    double-counted). Both RPCs gain a short-window exact-match guard,
--    same "recent identical request" shape used nowhere else in this
--    schema yet but modeled on this file's own notify_*_alerts() daily
--    dedup pattern (0001_05/0010/0026), just windowed in seconds instead of
--    a day since this is a double-click guard, not a once-a-day alert.
--    save_egg_sale() is deliberately NOT given the same guard — its
--    multi-item jsonb payload has no cheap, reliable natural key to dedupe
--    against without a schema change, and a duplicate click there produces
--    two distinct, individually-valid, stock-checked sales rather than any
--    corrupted state (the advisory lock already serializes the stock
--    math), so the cost/benefit doesn't justify it the way it does for the
--    single-item purchase RPCs.
--
-- 3. Changing a Staff member's assigned_poultry_house_id never notified
--    anyone — confirmed by grepping every trigger on `profiles` across all
--    prior migrations (only notify_new_staff_account, which only reacts to
--    farm_id changing). New trigger notifies the Staff member themselves
--    when their assignment changes, so the Feed Distribution modal's "new
--    assignment" isn't something they only discover by chance.
--
-- Depends on 0001_05_feeds_vitamins.sql (feeds, vitamins, feed_distribution,
-- vitamin_administration), 0001_08_notifications.sql (notifications),
-- 0015_poultry_houses.sql (poultry_houses), 0017_staff_poultry_house_assignment.sql
-- (profiles.assigned_poultry_house_id), 0029_inventory_purchases.sql
-- (purchase_transactions, purchase_items, record_feed_purchase, record_vitamin_purchase).

-- ── 1a. Feed Distribution: validate stock at insert/update time ─────────

create or replace function public.validate_feed_distribution_quantity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_remaining numeric;
  v_unit text;
begin
  -- Once approved, apply_feed_stock_delta() is the sole authority over
  -- remaining_stock deltas (including corrections to an approved row) and
  -- already validates increases there — this trigger only guards the
  -- pending/rejected lifecycle before that point.
  if new.status = 'approved' then
    return new;
  end if;

  select remaining_stock, unit into v_remaining, v_unit from public.feeds where id = new.feed_id;
  if v_remaining is null then
    raise exception 'Feed batch not found';
  end if;
  if new.quantity_used > v_remaining then
    raise exception 'Insufficient feed stock. Only % % available.', v_remaining, v_unit;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_feed_distribution_quantity_trigger on public.feed_distribution;
create trigger validate_feed_distribution_quantity_trigger
  before insert or update on public.feed_distribution
  for each row execute procedure public.validate_feed_distribution_quantity();

-- ── 1b. Vitamin Administration: same fix, same shape ─────────────────────

create or replace function public.validate_vitamin_administration_quantity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_remaining numeric;
  v_unit text;
begin
  if new.status = 'approved' then
    return new;
  end if;

  select remaining_stock, unit into v_remaining, v_unit from public.vitamins where id = new.vitamin_id;
  if v_remaining is null then
    raise exception 'Vitamin batch not found';
  end if;
  if new.quantity_used > v_remaining then
    raise exception 'Insufficient vitamin stock. Only % % available.', v_remaining, v_unit;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_vitamin_administration_quantity_trigger on public.vitamin_administration;
create trigger validate_vitamin_administration_quantity_trigger
  before insert or update on public.vitamin_administration
  for each row execute procedure public.validate_vitamin_administration_quantity();

-- ── 2a. record_feed_purchase(): reject an exact-duplicate resubmission ───

create or replace function public.record_feed_purchase(
  p_farm_id uuid,
  p_feed_name text,
  p_category text,
  p_brand text,
  p_batch_number text,
  p_supplier text,
  p_quantity numeric,
  p_unit text,
  p_package_size text,
  p_unit_price numeric,
  p_purchase_date date,
  p_expiration_date date,
  p_remarks text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_feed_id uuid;
  v_purchase_id uuid;
  v_reference text;
  v_total numeric;
  v_description text;
begin
  if public.current_farm_id() is distinct from p_farm_id or public.current_user_role() not in ('Farm Admin', 'Manager') then
    raise exception 'Not authorized to record purchases for this farm';
  end if;
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_unit_price < 0 then
    raise exception 'Price cannot be negative';
  end if;

  -- Double-submission guard: an identical purchase (same farm, same caller,
  -- same item/quantity/price) inserted in the last few seconds is treated
  -- as a double-click/retry, not a genuine second purchase.
  if exists (
    select 1
    from public.purchase_items pi
    join public.purchase_transactions pt on pt.id = pi.purchase_id
    where pt.farm_id = p_farm_id
      and pt.purchase_type = 'feed'
      and pt.created_by = auth.uid()
      and pt.created_at >= now() - interval '5 seconds'
      and pi.item_name = p_feed_name
      and pi.quantity = p_quantity
      and pi.unit_price = p_unit_price
  ) then
    raise exception 'This purchase looks like a duplicate submission. Please check Feed Inventory before trying again.';
  end if;

  v_total := round(p_quantity * p_unit_price, 2);
  v_reference := 'PUR-' || extract(year from p_purchase_date)::text || '-' || lpad(nextval('public.purchase_reference_seq')::text, 6, '0');

  insert into public.feeds (
    farm_id, feed_name, category, brand, batch_number, supplier,
    quantity, unit, package_size, remaining_stock, purchase_date, expiration_date, remarks
  )
  values (
    p_farm_id, p_feed_name, p_category, p_brand, p_batch_number, p_supplier,
    p_quantity, p_unit, p_package_size, p_quantity, p_purchase_date, p_expiration_date, p_remarks
  )
  returning id into v_feed_id;

  insert into public.purchase_transactions (farm_id, purchase_type, reference_number, purchase_date, subtotal, total_amount, payment_method, created_by)
  values (p_farm_id, 'feed', v_reference, p_purchase_date, v_total, v_total, 'cash', auth.uid())
  returning id into v_purchase_id;

  insert into public.purchase_items (purchase_id, inventory_type, inventory_item_id, item_name, category, quantity, unit, unit_price, total_price, package_size)
  values (v_purchase_id, 'feed', v_feed_id, p_feed_name, p_category, p_quantity, p_unit, p_unit_price, v_total, p_package_size);

  v_description := trim(both ' ' from coalesce(p_brand, '') || ' ' || coalesce(p_category, '') || ' Feed')
    || ' — ' || p_quantity || ' ' || p_unit
    || case when p_package_size is not null then ' (' || p_package_size || ')' else '' end;

  insert into public.expenses (farm_id, expense_date, category, description, amount, payment_method, source, purchase_id, recorded_by)
  values (p_farm_id, p_purchase_date, 'Feed', v_description, v_total, 'cash', 'inventory_purchase', v_purchase_id, auth.uid());

  return v_purchase_id;
end;
$$;

-- ── 2b. record_vitamin_purchase(): same guard ────────────────────────────

create or replace function public.record_vitamin_purchase(
  p_farm_id uuid,
  p_vitamin_name text,
  p_vitamin_type text,
  p_category text,
  p_brand text,
  p_batch_number text,
  p_supplier text,
  p_quantity numeric,
  p_unit text,
  p_package_size text,
  p_unit_price numeric,
  p_purchase_date date,
  p_expiration_date date,
  p_remarks text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_vitamin_id uuid;
  v_purchase_id uuid;
  v_reference text;
  v_total numeric;
  v_description text;
begin
  if public.current_farm_id() is distinct from p_farm_id or public.current_user_role() not in ('Farm Admin', 'Manager') then
    raise exception 'Not authorized to record purchases for this farm';
  end if;
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_unit_price < 0 then
    raise exception 'Price cannot be negative';
  end if;

  if exists (
    select 1
    from public.purchase_items pi
    join public.purchase_transactions pt on pt.id = pi.purchase_id
    where pt.farm_id = p_farm_id
      and pt.purchase_type = 'vitamin'
      and pt.created_by = auth.uid()
      and pt.created_at >= now() - interval '5 seconds'
      and pi.item_name = p_vitamin_name
      and pi.quantity = p_quantity
      and pi.unit_price = p_unit_price
  ) then
    raise exception 'This purchase looks like a duplicate submission. Please check Vitamin Inventory before trying again.';
  end if;

  v_total := round(p_quantity * p_unit_price, 2);
  v_reference := 'PUR-' || extract(year from p_purchase_date)::text || '-' || lpad(nextval('public.purchase_reference_seq')::text, 6, '0');

  insert into public.vitamins (
    farm_id, vitamin_name, vitamin_type, category, brand, batch_number, supplier,
    quantity, unit, package_size, remaining_stock, purchase_date, expiration_date, remarks
  )
  values (
    p_farm_id, p_vitamin_name, p_vitamin_type, p_category, p_brand, p_batch_number, p_supplier,
    p_quantity, p_unit, p_package_size, p_quantity, p_purchase_date, p_expiration_date, p_remarks
  )
  returning id into v_vitamin_id;

  insert into public.purchase_transactions (farm_id, purchase_type, reference_number, purchase_date, subtotal, total_amount, payment_method, created_by)
  values (p_farm_id, 'vitamin', v_reference, p_purchase_date, v_total, v_total, 'cash', auth.uid())
  returning id into v_purchase_id;

  insert into public.purchase_items (purchase_id, inventory_type, inventory_item_id, item_name, category, quantity, unit, unit_price, total_price, package_size)
  values (v_purchase_id, 'vitamin', v_vitamin_id, p_vitamin_name, p_category, p_quantity, p_unit, p_unit_price, v_total, p_package_size);

  v_description := p_vitamin_name || ' — ' || p_quantity || ' ' || p_unit;

  insert into public.expenses (farm_id, expense_date, category, description, amount, payment_method, source, purchase_id, recorded_by)
  values (p_farm_id, p_purchase_date, 'Medicine & Vitamins', v_description, v_total, 'cash', 'inventory_purchase', v_purchase_id, auth.uid());

  return v_purchase_id;
end;
$$;

-- ── 3. Notify Staff when their Poultry House/Pen assignment changes ─────

create or replace function public.notify_staff_house_assignment_changed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_house_name text;
begin
  if new.role <> 'Staff'
     or new.assigned_poultry_house_id is not distinct from old.assigned_poultry_house_id
     or not coalesce((select enabled from public.notification_settings where category = 'staff_assignment_changed'), true)
  then
    return new;
  end if;

  if new.assigned_poultry_house_id is null then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    values (
      new.id, new.farm_id, 'staff_assignment_changed', 'info', 'Poultry House/Pen Assignment Removed',
      'Your Poultry House/Pen assignment was removed. Contact your Farm Admin for a new assignment.',
      '/farm/feed'
    );
    return new;
  end if;

  select name into v_house_name from public.poultry_houses where id = new.assigned_poultry_house_id;

  insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
  values (
    new.id, new.farm_id, 'staff_assignment_changed', 'info', 'Poultry House/Pen Assignment Updated',
    'You are now assigned to ' || coalesce(v_house_name, 'a poultry house/pen') || '.',
    '/farm/feed'
  );
  return new;
end;
$$;

drop trigger if exists on_staff_house_assignment_changed on public.profiles;
create trigger on_staff_house_assignment_changed
  after update on public.profiles
  for each row execute procedure public.notify_staff_house_assignment_changed();

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in (
  'low_feed_stock', 'low_vitamin_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
  'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
  'expiring_medicine', 'low_egg_production', 'new_staff_account',
  'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
  'egg_production_submitted', 'task_assigned', 'task_completed', 'task_problem_reported', 'task_comment_added',
  'staff_assignment_changed'
));

alter table public.notification_settings drop constraint if exists notification_settings_category_check;
alter table public.notification_settings add constraint notification_settings_category_check check (category in (
  'new_user_registration', 'new_staff_account', 'mortality_alert', 'low_inventory',
  'low_egg_production', 'low_feed_stock', 'low_vitamin_stock', 'expiring_medicine',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
  'task_assigned', 'task_comment_added', 'task_problem_reported', 'task_completed',
  'egg_production_submitted', 'staff_assignment_changed'
));

insert into public.notification_settings (category) values ('staff_assignment_changed')
on conflict (category) do nothing;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0034_integrity_and_assignment_notifications')
on conflict (version) do nothing;
