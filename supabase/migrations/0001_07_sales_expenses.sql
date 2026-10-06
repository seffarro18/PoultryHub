-- PoultryHub — migration 0001_07: sales & expenses.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers the
-- "sales" category — a real financial ledger, deliberately independent from
-- egg_production's eggs_sold and poultry_inventory_events' 'sale' event type
-- (those are operational quantity counters with no price attached; this is
-- the money side, not auto-reconciled against either). No approval workflow
-- — mirrors feeds/vitamins' shape (Farm Admin/Manager write, Super Admin
-- read-only), not egg_production's Staff-submits shape. Staff gets no
-- policy on either table at all, matching the nav (Staff has zero access to
-- Sales & Expenses).
--
-- No "sale_items" table exists — sales are flat, one row per transaction,
-- no line-item breakdown. Nothing to split out here.
--
-- Depends on 0001_01_users_auth.sql and 0001_02_farms.sql.

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  sale_date date not null default current_date,
  item_category text not null check (item_category in ('Eggs', 'Live Birds', 'Manure', 'Other')),
  description text,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  unit_price numeric not null check (unit_price >= 0),
  total_amount numeric not null check (total_amount >= 0),
  buyer_name text,
  payment_status text not null default 'paid' check (payment_status in ('paid', 'pending', 'partial')),
  payment_method text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  expense_date date not null default current_date,
  category text not null check (category in ('Feed', 'Medicine & Vitamins', 'Utilities', 'Labor', 'Maintenance', 'Transport', 'Equipment', 'Other')),
  description text not null,
  amount numeric not null check (amount > 0),
  payment_method text,
  vendor text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_sales_updated_at on public.sales;
create trigger set_sales_updated_at
  before update on public.sales
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
  before update on public.expenses
  for each row execute procedure public.handle_updated_at();

alter table public.sales enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Super Admin can view all sales" on public.sales;
create policy "Super Admin can view all sales"
  on public.sales for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's sales" on public.sales;
create policy "Farm Admin or Manager can manage their farm's sales"
  on public.sales for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

drop policy if exists "Super Admin can view all expenses" on public.expenses;
create policy "Super Admin can view all expenses"
  on public.expenses for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's expenses" on public.expenses;
create policy "Farm Admin or Manager can manage their farm's expenses"
  on public.expenses for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

create index if not exists sales_farm_id_idx on public.sales (farm_id);
create index if not exists sales_sale_date_idx on public.sales (sale_date);
create index if not exists expenses_farm_id_idx on public.expenses (farm_id);
create index if not exists expenses_expense_date_idx on public.expenses (expense_date);

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_07_sales_expenses')
on conflict (version) do nothing;
