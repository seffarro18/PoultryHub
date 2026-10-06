-- PoultryHub — migration 0024: multi-egg-size sales.
--
-- Replaces the one-item-per-sale shape with a parent/child structure:
-- `sales` stays the transaction header (date, buyer, payment, total), and a
-- new `sale_items` table holds one row per egg size + tray unit combination
-- sold in that transaction. `sales.quantity`/`unit`/`unit_price` are relaxed
-- to nullable rather than dropped — any pre-existing single-item sale (or a
-- non-Eggs category, which this feature doesn't touch) keeps using them;
-- new Eggs sales leave them null and use `sale_items` instead.
--
-- All writes go through `save_egg_sale()`, a security-definer function that
-- validates every line's stock (per egg size, against approved
-- egg_production minus everything already sold of that size) before writing
-- anything — so a sale with one bad line never partially saves. Stock here
-- is derived (summed at read time), not a physical row to `select ... for
-- update`, so concurrent sales against the same farm+size are serialized
-- instead via `pg_advisory_xact_lock`.
--
-- Depends on 0001_07_sales_expenses.sql (sales), 0021_egg_pricing_production_settings.sql
-- (egg_prices), 0023_egg_production_six_sizes.sql (egg_production's 6 size columns).

-- ── Relax sales' single-item columns to nullable ────────────────────────
alter table public.sales alter column quantity drop not null;
alter table public.sales alter column unit drop not null;
alter table public.sales alter column unit_price drop not null;

alter table public.sales drop constraint if exists sales_quantity_check;
alter table public.sales add constraint sales_quantity_check check (quantity is null or quantity > 0);

alter table public.sales drop constraint if exists sales_unit_price_check;
alter table public.sales add constraint sales_unit_price_check check (unit_price is null or unit_price >= 0);

-- ── sale_items ───────────────────────────────────────────────────────────

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  egg_size text not null check (egg_size in ('Peewee', 'Small', 'Medium', 'Large', 'X Large', 'Jumbo')),
  unit_type text not null check (unit_type in ('full_tray', 'half_tray')),
  quantity numeric not null check (quantity > 0),
  eggs_count numeric not null check (eggs_count > 0),
  unit_price numeric not null check (unit_price >= 0),
  line_total numeric not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

alter table public.sale_items enable row level security;

-- SELECT-only — every write happens inside save_egg_sale() below, which
-- runs security definer (bypasses RLS as its owner), so there's no direct
-- insert/update/delete path for any role to accidentally bypass its
-- validation. Same parent-join technique as task_comments' policies
-- (0011_tasks.sql: `exists (select 1 from tasks t where t.id = task_id ...)`).
drop policy if exists "Super Admin can view all sale items" on public.sale_items;
create policy "Super Admin can view all sale items"
  on public.sale_items for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can view their farm's sale items" on public.sale_items;
create policy "Farm Admin or Manager can view their farm's sale items"
  on public.sale_items for select
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_id
        and s.farm_id = public.current_farm_id()
        and public.current_user_role() in ('Farm Admin', 'Manager')
    )
  );

create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);
create index if not exists sale_items_egg_size_idx on public.sale_items (egg_size);

-- ── save_egg_sale(): create-or-update, atomic, stock-validated ──────────

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
    values (p_farm_id, p_sale_date, 'Eggs', 'Cash', p_payment_status, p_buyer_name, p_remarks, 0)
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

revoke execute on function public.save_egg_sale(uuid, uuid, date, text, text, text, jsonb) from public;
grant execute on function public.save_egg_sale(uuid, uuid, date, text, text, text, jsonb) to authenticated;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0024_sales_multi_item')
on conflict (version) do nothing;
