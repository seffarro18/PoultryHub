-- PoultryHub — migration 0030: lock Staff out of confidential financial data.
--
-- Three independent fixes, all closing a gap where Staff had DB-level read
-- access to pricing/cost data that the frontend never happened to show them
-- — meaning a Staff user inspecting network requests (or a future UI change
-- that forgot to filter) could already retrieve it:
--
-- 1. egg_prices — Staff had a SELECT policy ("look prices up when recording
--    a sale") that no longer applies: Sales & Expenses is Farm Admin/Manager
--    only, Staff never records a sale, so Staff has no legitimate reason to
--    read selling prices at all. Dropped outright, not narrowed.
-- 2. purchase_transactions / purchase_items — granted Staff SELECT access
--    (0029) under the same farm-roles list used for every other
--    operational table, without noticing purchase_items carries unit_price/
--    total_price (what the farm paid for feed/vitamins) — exactly the
--    "Feed/Vitamin Purchase Prices" the Staff dashboard spec forbids.
--    Narrowed to Farm Admin/Manager only.
-- 3. get_remaining_egg_stock(p_farm_id) — new security-definer RPC so the
--    Staff Dashboard's "Remaining Eggs" quantity can still be computed
--    correctly (good eggs minus eggs already sold) without Staff ever
--    querying `sales`/`sale_items` directly — those rows carry unit_price/
--    line_total/total_amount, which Staff's existing lack of any `sales`
--    SELECT policy (0001_07) already correctly denies. The function returns
--    one number, never a row, so no financial column can leak through it
--    regardless of caller role; it still checks the caller's own farm_id,
--    same authorization shape as every other RPC in this schema.
--
-- Depends on 0001_07_sales_expenses.sql (sales, sale_items from 0024),
-- 0021_egg_pricing_production_settings.sql (egg_prices), 0023 (egg_production
-- 6-size columns), 0024_sales_multi_item.sql (sale_items), 0029_inventory_purchases.sql
-- (purchase_transactions, purchase_items).

-- ── 1. egg_prices: remove Staff's read access entirely ──────────────────
drop policy if exists "Staff can view their farm's egg prices" on public.egg_prices;

-- ── 2. purchase_transactions / purchase_items: Farm Admin/Manager only ───
drop policy if exists "Farm users can view their farm's purchase transactions" on public.purchase_transactions;
create policy "Farm Admin or Manager can view their farm's purchase transactions"
  on public.purchase_transactions for select
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'));

drop policy if exists "Farm users can view their farm's purchase items" on public.purchase_items;
create policy "Farm Admin or Manager can view their farm's purchase items"
  on public.purchase_items for select
  using (
    exists (
      select 1 from public.purchase_transactions pt
      where pt.id = purchase_id
        and pt.farm_id = public.current_farm_id()
        and public.current_user_role() in ('Farm Admin', 'Manager')
    )
  );

-- ── 3. get_remaining_egg_stock(): quantity-only, no price columns ───────
create or replace function public.get_remaining_egg_stock(p_farm_id uuid)
returns numeric
language plpgsql
security definer set search_path = public
as $$
declare
  v_good_eggs numeric;
  v_sold_via_items numeric;
  v_sold_legacy numeric;
begin
  if public.current_farm_id() is distinct from p_farm_id then
    raise exception 'Not authorized to view this farm''s egg stock';
  end if;

  select coalesce(sum(good_eggs), 0) into v_good_eggs
  from public.egg_production
  where farm_id = p_farm_id and status = 'approved';

  select coalesce(sum(si.eggs_count), 0) into v_sold_via_items
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where s.farm_id = p_farm_id and s.item_category = 'Eggs';

  select coalesce(sum(s.quantity * case s.unit when 'Full Tray' then 30 when 'Half Tray' then 15 else 1 end), 0)
  into v_sold_legacy
  from public.sales s
  where s.farm_id = p_farm_id
    and s.item_category = 'Eggs'
    and s.quantity is not null
    and not exists (select 1 from public.sale_items si where si.sale_id = s.id);

  return greatest(v_good_eggs - v_sold_via_items - v_sold_legacy, 0);
end;
$$;

revoke execute on function public.get_remaining_egg_stock(uuid) from public;
grant execute on function public.get_remaining_egg_stock(uuid) to authenticated;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0030_staff_financial_restrictions')
on conflict (version) do nothing;
