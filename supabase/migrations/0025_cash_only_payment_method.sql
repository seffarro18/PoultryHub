-- PoultryHub — migration 0025: Cash-only payment method, canonical value.
--
-- Sales already only ever record "Cash" (0024_sales_multi_item.sql hardcodes
-- it — there's no payment method choice in the Sale form). Expenses now get
-- the same restriction at the client (ExpenseFormDrawer's dropdown is
-- removed in favor of a static "Cash" display), and both features settle on
-- one canonical lowercase stored value — "cash" — instead of the "Cash"
-- literal save_egg_sale() previously inserted.
--
-- No check constraint is added on sales.payment_method or
-- expenses.payment_method: neither column has ever been constrained (both
-- are, and remain, plain free text), and a new record is guaranteed "cash"
-- by the client/RPC alone. Adding one now would either reject or need to
-- special-case every pre-existing row recorded under the old dropdown
-- (Cash/GCash/Bank Transfer/Other free text) — exactly the "don't silently
-- normalize historical financial records" this feature was asked to avoid.
-- Old rows keep whatever payment method they actually used.
--
-- Only save_egg_sale()'s inserted literal changes here (Cash -> cash) —
-- same function, same signature, CREATE OR REPLACE.

create or replace function public.save_egg_sale(
  p_sale_id uuid,
  p_farm_id uuid,
  p_sale_date date,
  p_buyer_name text,
  p_payment_status text,
  p_remarks text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_size text;
  v_good_field text;
  v_available numeric;
  v_required numeric;
  v_item record;
  v_price record;
  v_total numeric := 0;
  v_sale_id uuid;
begin
  if public.current_farm_id() is distinct from p_farm_id or public.current_user_role() not in ('Farm Admin', 'Manager') then
    raise exception 'Not authorized to record sales for this farm';
  end if;

  if not exists (select 1 from jsonb_to_recordset(p_items) as x(egg_size text, unit_type text, quantity numeric)) then
    raise exception 'At least one egg item is required';
  end if;

  -- Editing: drop the old line items first so their eggs are freed back
  -- into "available" before the new requested amounts are validated below.
  if p_sale_id is not null then
    if not exists (select 1 from public.sales where id = p_sale_id and farm_id = p_farm_id) then
      raise exception 'Sale not found';
    end if;
    delete from public.sale_items where sale_id = p_sale_id;
  end if;

  -- Validate every distinct egg size this sale touches, one at a time.
  for v_size in
    select distinct egg_size from jsonb_to_recordset(p_items) as x(egg_size text, unit_type text, quantity numeric)
  loop
    -- Serializes concurrent sales against the same farm+size — stock is
    -- derived (summed at read time), not a physical row this could lock.
    perform pg_advisory_xact_lock(hashtextextended(p_farm_id::text || ':' || v_size, 0));

    v_good_field := case v_size
      when 'Peewee' then 'peewee_eggs'
      when 'Small' then 'small_eggs'
      when 'Medium' then 'medium_eggs'
      when 'Large' then 'large_eggs'
      when 'X Large' then 'x_large_eggs'
      when 'Jumbo' then 'jumbo_eggs'
    end;

    execute format(
      'select coalesce(sum(%I), 0) from public.egg_production where farm_id = $1 and status = ''approved''',
      v_good_field
    ) into v_available using p_farm_id;

    select v_available - coalesce(sum(si.eggs_count), 0) into v_available
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where s.farm_id = p_farm_id and si.egg_size = v_size;

    select sum(x.quantity * case when x.unit_type = 'full_tray' then 30 else 15 end) into v_required
    from jsonb_to_recordset(p_items) as x(egg_size text, unit_type text, quantity numeric)
    where x.egg_size = v_size;

    if v_available < v_required then
      raise exception 'Insufficient % egg stock. Available: %, Required: %.', v_size, v_available, v_required;
    end if;
  end loop;

  -- Every size validated — safe to write. Upsert the parent sales row.
  if p_sale_id is null then
    insert into public.sales (
      farm_id, sale_date, item_category, payment_method, payment_status, buyer_name, remarks, total_amount
    )
    values (p_farm_id, p_sale_date, 'Eggs', 'cash', p_payment_status, p_buyer_name, p_remarks, 0)
    returning id into v_sale_id;
  else
    v_sale_id := p_sale_id;
    update public.sales
    set sale_date = p_sale_date, buyer_name = p_buyer_name, payment_status = p_payment_status, remarks = p_remarks
    where id = v_sale_id;
  end if;

  -- Combined (egg_size, unit_type) groups — two input rows for the same
  -- size+unit land as one sale_items row (belt-and-suspenders backing the
  -- client-side auto-combine).
  for v_item in
    select egg_size, unit_type, sum(quantity)::numeric as quantity
    from jsonb_to_recordset(p_items) as x(egg_size text, unit_type text, quantity numeric)
    group by egg_size, unit_type
  loop
    select full_tray_price, half_tray_price into v_price
    from public.egg_prices where farm_id = p_farm_id and egg_size = v_item.egg_size;
    if not found then
      raise exception 'No egg price configured for %', v_item.egg_size;
    end if;

    insert into public.sale_items (sale_id, egg_size, unit_type, quantity, eggs_count, unit_price, line_total)
    values (
      v_sale_id, v_item.egg_size, v_item.unit_type, v_item.quantity,
      v_item.quantity * case when v_item.unit_type = 'full_tray' then 30 else 15 end,
      case when v_item.unit_type = 'full_tray' then v_price.full_tray_price else v_price.half_tray_price end,
      v_item.quantity * case when v_item.unit_type = 'full_tray' then v_price.full_tray_price else v_price.half_tray_price end
    );
    v_total := v_total + v_item.quantity * case when v_item.unit_type = 'full_tray' then v_price.full_tray_price else v_price.half_tray_price end;
  end loop;

  update public.sales set total_amount = v_total where id = v_sale_id;

  return v_sale_id;
end;
$$;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0025_cash_only_payment_method')
on conflict (version) do nothing;
