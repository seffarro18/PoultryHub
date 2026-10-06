-- PoultryHub — migration 0029: Feed/Vitamin purchases -> Expenses.
--
-- Connects "Add Feed Stock"/"Add Vitamin Stock" to the Expenses module so a
-- Farm Admin records a purchase exactly once: `record_feed_purchase()`/
-- `record_vitamin_purchase()` (security-definer RPCs, one DB transaction
-- each) atomically (a) insert the new feeds/vitamins batch, (b) insert a
-- purchase_transactions + purchase_items pair for the printable receipt, and
-- (c) insert the matching expenses row (category Feed / Medicine &
-- Vitamins, payment_method cash) tagged with source='inventory_purchase'
-- and purchase_id — so Expenses can tell an auto-generated purchase expense
-- apart from a manually-recorded one, and never double-count it.
--
-- Reuses the existing `expenses` table (adds two columns, no new table) per
-- "do not create a duplicate Expenses table" — only purchase_transactions/
-- purchase_items are genuinely new, since nothing in this schema already
-- models a multi-field purchase receipt.
--
-- Editing an existing feeds/vitamins batch (updateFeedBatch/
-- updateVitaminBatch, unchanged) is a correction to stock on hand, not a new
-- purchase — it intentionally does NOT go through these RPCs and never
-- creates a second expense. Feed/vitamin USAGE (feed_distribution/
-- vitamin_administration) is a separate, pre-existing workflow that only
-- ever deducts remaining_stock and was never wired to Expenses — untouched
-- here, preserving "usage reduces inventory, never creates an expense".
--
-- Depends on 0001_05_feeds_vitamins.sql (feeds, vitamins),
-- 0001_07_sales_expenses.sql (expenses), 0001_01_users_auth.sql,
-- 0001_02_farms.sql.

-- ── Vitamins already has vitamin_type/package_size (0026) — feeds gets its
-- own package_size here, same "informational, never used to compute stock"
-- field, now that its Unit is just "Sack"/"Bag" with the size held separately.
alter table public.feeds add column if not exists package_size text;

-- ── Expenses: tell an auto-generated purchase expense apart from a manual one ──
alter table public.expenses add column if not exists source text not null default 'manual'
  check (source in ('manual', 'inventory_purchase'));
alter table public.expenses add column if not exists purchase_id uuid;

-- ── purchase_transactions / purchase_items ──────────────────────────────

create table if not exists public.purchase_transactions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  purchase_type text not null check (purchase_type in ('feed', 'vitamin')),
  reference_number text not null unique,
  purchase_date date not null,
  subtotal numeric not null check (subtotal >= 0),
  total_amount numeric not null check (total_amount >= 0),
  payment_method text not null default 'cash',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_transactions (id) on delete cascade,
  inventory_type text not null check (inventory_type in ('feed', 'vitamin')),
  -- Polymorphic — points at feeds.id or vitamins.id depending on
  -- inventory_type, so no single FK constraint applies (Postgres can't
  -- target two tables conditionally). Deliberately not cascaded from either
  -- table: deleting a batch should never silently erase part of the
  -- purchase/expense audit trail.
  inventory_item_id uuid,
  item_name text not null,
  category text,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  unit_price numeric not null check (unit_price >= 0),
  total_price numeric not null check (total_price >= 0),
  package_size text,
  created_at timestamptz not null default now()
);

-- Now that purchase_transactions exists, point expenses.purchase_id at it for real.
alter table public.expenses drop constraint if exists expenses_purchase_id_fkey;
alter table public.expenses add constraint expenses_purchase_id_fkey
  foreign key (purchase_id) references public.purchase_transactions (id) on delete set null;

create sequence if not exists public.purchase_reference_seq;

alter table public.purchase_transactions enable row level security;
alter table public.purchase_items enable row level security;

drop policy if exists "Super Admin can view all purchase transactions" on public.purchase_transactions;
create policy "Super Admin can view all purchase transactions"
  on public.purchase_transactions for select
  using (public.is_super_admin());

-- SELECT-only for farm roles too — every write happens inside the RPCs
-- below (security definer, bypasses RLS as their owner), same "no direct
-- write path" approach as sale_items (0024_sales_multi_item.sql).
drop policy if exists "Farm users can view their farm's purchase transactions" on public.purchase_transactions;
create policy "Farm users can view their farm's purchase transactions"
  on public.purchase_transactions for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager', 'Staff'));

drop policy if exists "Super Admin can view all purchase items" on public.purchase_items;
create policy "Super Admin can view all purchase items"
  on public.purchase_items for select
  using (public.is_super_admin());

drop policy if exists "Farm users can view their farm's purchase items" on public.purchase_items;
create policy "Farm users can view their farm's purchase items"
  on public.purchase_items for select
  using (
    exists (
      select 1 from public.purchase_transactions pt
      where pt.id = purchase_id
        and pt.farm_id = public.current_farm_id()
        and public.current_user_role() in ('Farm Admin', 'Manager', 'Staff')
    )
  );

create index if not exists purchase_transactions_farm_id_idx on public.purchase_transactions (farm_id);
create index if not exists purchase_items_purchase_id_idx on public.purchase_items (purchase_id);
create index if not exists expenses_purchase_id_idx on public.expenses (purchase_id);

-- ── record_feed_purchase(): one purchase = one feeds batch + one receipt + one expense ──

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

revoke execute on function public.record_feed_purchase(uuid, text, text, text, text, text, numeric, text, text, numeric, date, date, text) from public;
grant execute on function public.record_feed_purchase(uuid, text, text, text, text, text, numeric, text, text, numeric, date, date, text) to authenticated;

-- ── record_vitamin_purchase(): same shape, for vitamins ──────────────────

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

revoke execute on function public.record_vitamin_purchase(uuid, text, text, text, text, text, text, numeric, text, text, numeric, date, date, text) from public;
grant execute on function public.record_vitamin_purchase(uuid, text, text, text, text, text, text, numeric, text, text, numeric, date, date, text) to authenticated;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0029_inventory_purchases')
on conflict (version) do nothing;
