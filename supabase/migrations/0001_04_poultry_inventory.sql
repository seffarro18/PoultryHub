-- PoultryHub — migration 0001_04: poultry inventory.
--
-- Part of the split-by-category baseline (see AGENTS.md). Covers the
-- "poultry_inventory" / "poultry_stock_transactions" categories — both map
-- to the same real table, `poultry_inventory_events`. This is an
-- event-sourced ledger, not a stock table: "current stock" for a farm/bird
-- type is derived at read time by summing its events (see
-- poultryInventoryService.ts), so there's no separate total that could ever
-- drift out of sync with the log. No approval workflow here (unlike egg
-- production) — Staff's entries take effect immediately, within the limited
-- event types RLS allows them.
--
-- Depends on 0001_01_users_auth.sql and 0001_02_farms.sql (specifically
-- farms.staff_can_delete_inventory, added there before this file's RLS
-- policies reference it).
--
-- notify_inventory_alerts() references public.notifications and
-- public.notification_settings, neither created until later files — safe,
-- same lazy-function-body reasoning as 0001_03's notify_low_egg_production().

do $$
begin
  if not exists (select 1 from pg_type where typname = 'poultry_bird_type') then
    create type public.poultry_bird_type as enum ('Layer', 'Chick', 'Grower', 'Breeder');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'poultry_event_type') then
    create type public.poultry_event_type as enum ('arrival', 'transfer', 'sale', 'mortality', 'count_update');
  end if;
end $$;

create table if not exists public.poultry_inventory_events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  event_date date not null,
  bird_type public.poultry_bird_type not null,
  event_type public.poultry_event_type not null,
  -- Only a count_update correction can be negative (e.g. a recount finds
  -- fewer than recorded) — every other event type is an unsigned count.
  quantity int not null check (quantity <> 0) check (event_type = 'count_update' or quantity > 0),
  from_house_pen text,
  to_house_pen text,
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_poultry_inventory_events_updated_at on public.poultry_inventory_events;
create trigger set_poultry_inventory_events_updated_at
  before update on public.poultry_inventory_events
  for each row execute procedure public.handle_updated_at();

alter table public.poultry_inventory_events enable row level security;

drop policy if exists "Super Admin can view all inventory events" on public.poultry_inventory_events;
create policy "Super Admin can view all inventory events"
  on public.poultry_inventory_events for select
  using (public.is_super_admin());

drop policy if exists "Farm Admin or Manager can manage their farm's inventory" on public.poultry_inventory_events;
create policy "Farm Admin or Manager can manage their farm's inventory"
  on public.poultry_inventory_events for all
  using (farm_id = public.current_farm_id() and public.current_user_role() in ('Farm Admin', 'Manager'))
  with check (farm_id = public.current_farm_id());

-- Staff: can log arrivals/transfers/count updates (not sales or mortality —
-- enforced here, not just hidden in the UI, so it can't be bypassed by
-- calling the API directly)...
drop policy if exists "Staff can log limited inventory events for their farm" on public.poultry_inventory_events;
create policy "Staff can log limited inventory events for their farm"
  on public.poultry_inventory_events for insert
  with check (
    farm_id = public.current_farm_id()
    and public.current_user_role() = 'Staff'
    and event_type in ('arrival', 'transfer', 'count_update')
  );

-- ...can see the farm's whole log, including sale/mortality entries they
-- couldn't have created themselves...
drop policy if exists "Staff can view their farm's inventory events" on public.poultry_inventory_events;
create policy "Staff can view their farm's inventory events"
  on public.poultry_inventory_events for select
  using (farm_id = public.current_farm_id() and public.current_user_role() = 'Staff');

-- ...can correct their own entries...
drop policy if exists "Staff can edit their own inventory events" on public.poultry_inventory_events;
create policy "Staff can edit their own inventory events"
  on public.poultry_inventory_events for update
  using (recorded_by = auth.uid() and public.current_user_role() = 'Staff')
  with check (recorded_by = auth.uid() and farm_id = public.current_farm_id());

-- ...and can only delete their own entries, and only when their farm's own
-- Farm Admin has explicitly allowed it via farms.staff_can_delete_inventory.
drop policy if exists "Staff can delete their own inventory events if permitted" on public.poultry_inventory_events;
create policy "Staff can delete their own inventory events if permitted"
  on public.poultry_inventory_events for delete
  using (
    recorded_by = auth.uid()
    and public.current_user_role() = 'Staff'
    and exists (
      select 1 from public.farms
      where id = poultry_inventory_events.farm_id and staff_can_delete_inventory = true
    )
  );

create index if not exists poultry_inventory_events_farm_id_idx on public.poultry_inventory_events (farm_id);
create index if not exists poultry_inventory_events_event_date_idx on public.poultry_inventory_events (event_date);
create index if not exists poultry_inventory_events_bird_type_idx on public.poultry_inventory_events (bird_type);

-- Mortality Alerts (Super Admin) / High Mortality (Farm Admin/Manager) and
-- Low Inventory (Super Admin): 5%-of-stock-in-7-days heuristic, reimplements
-- in SQL what poultryInventoryService.ts's mortalityAlerts() already does
-- client-side. Dedupes per farm/category/day so a busy day of qualifying
-- events produces one alert, not a flood.
create or replace function public.notify_inventory_alerts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_farm_name text;
  v_stock int;
  v_bird_type_stock int;
  v_mortality_7d int;
begin
  select name into v_farm_name from public.farms where id = new.farm_id;

  -- Total stock across every bird type — used for the mortality percentage,
  -- same denominator as the client-side mortalityAlerts() heuristic.
  select coalesce(sum(quantity), 0) into v_stock
  from public.poultry_inventory_events
  where farm_id = new.farm_id and event_type <> 'transfer';

  -- Stock for just the bird type this event touched — Low Inventory is a
  -- per-bird-type alert ("Layers are down to 8"), not a whole-flock total.
  select coalesce(sum(quantity), 0) into v_bird_type_stock
  from public.poultry_inventory_events
  where farm_id = new.farm_id and event_type <> 'transfer' and bird_type = new.bird_type;

  if new.event_type = 'mortality' then
    select coalesce(sum(quantity), 0) into v_mortality_7d
    from public.poultry_inventory_events
    where farm_id = new.farm_id
      and event_type = 'mortality'
      and event_date >= (current_date - interval '7 days');

    if v_stock > 0 and v_mortality_7d > (0.05 * v_stock)
       and coalesce((select enabled from public.notification_settings where category = 'mortality_alert'), true)
       and not exists (
      select 1 from public.notifications
      where farm_id = new.farm_id and category = 'mortality_alert' and created_at >= date_trunc('day', now())
    ) then
      insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
      select id, new.farm_id, 'mortality_alert', 'critical', 'Mortality Alert',
             v_farm_name || ' has lost ' || v_mortality_7d || ' birds in the last 7 days (over 5% of its stock).',
             '/dashboard/production/inventory'
      from public.profiles where role = 'Super Admin';

      insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
      select id, new.farm_id, 'mortality_alert', 'critical', 'High Mortality Alert',
             'Your farm has lost ' || v_mortality_7d || ' birds in the last 7 days (over 5% of your stock).',
             '/farm/inventory'
      from public.profiles where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
    end if;
  end if;

  if new.event_type in ('mortality', 'sale', 'count_update') and v_bird_type_stock <= 10
     and coalesce((select enabled from public.notification_settings where category = 'low_inventory'), true)
     and not exists (
    select 1 from public.notifications
    where farm_id = new.farm_id and category = 'low_inventory' and created_at >= date_trunc('day', now())
  ) then
    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'low_inventory', 'warning', 'Low Inventory',
           v_farm_name || '''s ' || new.bird_type || ' stock is down to ' || v_bird_type_stock || '.',
           '/dashboard/production/inventory'
    from public.profiles where role = 'Super Admin';
  end if;

  return new;
end;
$$;

drop trigger if exists on_inventory_event_notify on public.poultry_inventory_events;
create trigger on_inventory_event_notify
  after insert on public.poultry_inventory_events
  for each row execute procedure public.notify_inventory_alerts();

-- ── Poultry Inventory consolidation ──────────────────────────────────────
-- UI-only merge of the Poultry Inventory / Feed & Vitamins / Mortality
-- Records pages into one tabbed "Poultry Inventory" module — these tables
-- stay separate entities, nothing here changes that. The event-sourced
-- ledger only ever recorded movements (who/what/when/how many) — the
-- Poultry Stock tab also wants batch-descriptive attributes. Meaningful
-- mainly on 'arrival' rows (a batch of birds arriving); optional and blank
-- on every other event type, same "add nullable column, fill in
-- progressively" pattern used everywhere else in this file.
alter table public.poultry_inventory_events add column if not exists breed text;
alter table public.poultry_inventory_events add column if not exists age_label text;
alter table public.poultry_inventory_events add column if not exists source text;
alter table public.poultry_inventory_events add column if not exists status text;

-- ── Record this migration as applied ─────────────────────────────────────
insert into public.schema_migrations (version) values ('0001_04_poultry_inventory')
on conflict (version) do nothing;
