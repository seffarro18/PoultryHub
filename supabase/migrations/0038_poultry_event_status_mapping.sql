  -- PoultryHub — migration 0038: Event Type <-> Status enforced at the
  -- database level, Culling support in stock/notification logic.
  --
  -- Run AFTER 0037 has already been applied and committed on its own (see
  -- 0037's header for why).
  --
  -- 1. Backfills `status` to match `event_type` for every existing non-
  --    'mortality' row (old rows predate the `status` column and are simply
  --    null today) — this is restoring the intended invariant, not rewriting
  --    what actually happened: an 'arrival' row was always functionally
  --    "Active" stock, this just makes that explicit so the new constraint
  --    below can be added without rejecting real historical data. 'mortality'
  --    rows are left untouched — that event type is a deprecated, pre-
  --    approval-workflow path (see 0001_04's own comment), never created by
  --    the current form, and was never part of this Active/Sold/Culled/
  --    Transferred vocabulary to begin with.
  -- 2. Adds a CHECK constraint so the Event Type -> Status mapping can't be
  --    violated by ANY writer, not just this app's own form — exactly what
  --    section 7/9 of this feature's spec asks for ("the database must also
  --    reject invalid combinations").
  -- 3. Fixes a real pre-existing sign bug in notify_inventory_alerts(): it
  --    summed `quantity` raw (ignoring that a 'sale'/'mortality' row still
  --    counts toward stock reduction, not addition) when computing both the
  --    farm-wide total and the low-inventory per-bird-type total — so Low
  --    Inventory/Mortality-percentage alerts were computed against an
  --    overstated stock figure. Rewritten to sign quantity the same way
  --    poultryInventoryService.ts's currentStockByType/currentStockByFarm
  --    already do client-side, and extended to treat the new 'culling' type
  --    the same way 'sale' already was.
  -- 4. Adds a notification when an arrival/transfer/sale/culling is recorded
  --    — reuses the existing notifications table/architecture, no new table.
  --
  -- Depends on 0001_04_poultry_inventory.sql (poultry_inventory_events,
  -- notify_inventory_alerts), 0037_poultry_culling_event_type.sql (the
  -- 'culling' enum value must already exist).

  -- ── 1. Backfill status to match event_type for existing rows ────────────

  update public.poultry_inventory_events
  set status = case event_type
    when 'arrival' then 'Active'
    when 'transfer' then 'Transferred'
    when 'sale' then 'Sold'
    when 'count_update' then 'Active'
    else status
  end
  where event_type <> 'mortality'
    and status is distinct from case event_type
      when 'arrival' then 'Active'
      when 'transfer' then 'Transferred'
      when 'sale' then 'Sold'
      when 'count_update' then 'Active'
      else status
    end;

  -- ── 2. Event Type -> Status mapping, enforced for every writer ──────────

  alter table public.poultry_inventory_events drop constraint if exists poultry_inventory_events_status_matches_event_type;
  alter table public.poultry_inventory_events add constraint poultry_inventory_events_status_matches_event_type check (
    case event_type
      when 'arrival' then status = 'Active'
      when 'transfer' then status = 'Transferred'
      when 'sale' then status = 'Sold'
      when 'culling' then status = 'Culled'
      when 'count_update' then status = 'Active'
      else true -- 'mortality': deprecated path, not part of this vocabulary
    end
  );

  -- ── 3. Fix notify_inventory_alerts()'s stock sign bug + add culling ──────

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

    -- Signed the same way currentStockByType/currentStockByFarm already do
    -- client-side: sale/culling/mortality reduce stock, transfer is excluded
    -- entirely (it only moves birds between pens on the same farm).
    select coalesce(sum(case when event_type in ('sale', 'culling', 'mortality') then -quantity else quantity end), 0)
    into v_stock
    from public.poultry_inventory_events
    where farm_id = new.farm_id and event_type <> 'transfer';

    select coalesce(sum(case when event_type in ('sale', 'culling', 'mortality') then -quantity else quantity end), 0)
    into v_bird_type_stock
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

    if new.event_type in ('mortality', 'sale', 'culling', 'count_update') and v_bird_type_stock <= 10
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

  -- ── 4. Notify Farm Admin/Manager when an inventory event is recorded ────
  -- One notification per insert (not update, so a correction doesn't spam a
  -- fresh notification) — excludes the recorder themselves, so Staff logging
  -- an arrival notifies the Farm Admin but a Farm Admin recording their own
  -- sale doesn't notify themselves a second time.

  create or replace function public.notify_poultry_event_recorded()
  returns trigger
  language plpgsql
  security definer set search_path = public
  as $$
  declare
    v_message text;
  begin
    if new.event_type not in ('arrival', 'transfer', 'sale', 'culling') then
      return new;
    end if;
    if not coalesce((select enabled from public.notification_settings where category = 'poultry_event_recorded'), true) then
      return new;
    end if;

    v_message := case new.event_type
      when 'arrival' then new.quantity || ' layer chickens arrived' || coalesce(' at ' || new.to_house_pen, '') || '.'
      when 'transfer' then new.quantity || ' layer chickens were transferred' ||
        coalesce(' from ' || new.from_house_pen, '') || coalesce(' to ' || new.to_house_pen, '') || '.'
      when 'sale' then new.quantity || ' layer chickens were sold' || coalesce(' from ' || new.from_house_pen, '') || '.'
      when 'culling' then new.quantity || ' layer chickens were culled' || coalesce(' from ' || new.from_house_pen, '') || '.'
    end;

    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'poultry_event_recorded', 'info',
          case new.event_type
            when 'arrival' then 'New Arrival'
            when 'transfer' then 'Transfer Between Pens'
            when 'sale' then 'Sale'
            when 'culling' then 'Culling'
          end,
          v_message, '/farm/inventory'
    from public.profiles
    where farm_id = new.farm_id and role in ('Farm Admin', 'Manager') and id <> new.recorded_by;

    return new;
  end;
  $$;

  drop trigger if exists on_poultry_event_recorded_notify on public.poultry_inventory_events;
  create trigger on_poultry_event_recorded_notify
    after insert on public.poultry_inventory_events
    for each row execute procedure public.notify_poultry_event_recorded();

  alter table public.notifications drop constraint if exists notifications_category_check;
  alter table public.notifications add constraint notifications_category_check check (category in (
    'low_feed_stock', 'low_vitamin_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
    'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
    'expiring_medicine', 'low_egg_production', 'new_staff_account',
    'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment',
    'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
    'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
    'egg_production_submitted', 'task_assigned', 'task_completed', 'task_problem_reported', 'task_comment_added',
    'staff_assignment_changed', 'feed_distribution_reviewed', 'vitamin_administration_reviewed',
    'poultry_event_recorded'
  ));

  alter table public.notification_settings drop constraint if exists notification_settings_category_check;
  alter table public.notification_settings add constraint notification_settings_category_check check (category in (
    'new_user_registration', 'new_staff_account', 'mortality_alert', 'low_inventory',
    'low_egg_production', 'low_feed_stock', 'low_vitamin_stock', 'expiring_medicine',
    'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
    'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
    'task_assigned', 'task_comment_added', 'task_problem_reported', 'task_completed',
    'egg_production_submitted', 'staff_assignment_changed',
    'feed_distribution_reviewed', 'vitamin_administration_reviewed', 'poultry_event_recorded'
  ));

  insert into public.notification_settings (category) values ('poultry_event_recorded')
  on conflict (category) do nothing;

  -- ── Record this migration as applied ─────────────────────────────────────
  insert into public.schema_migrations (version) values ('0038_poultry_event_status_mapping')
  on conflict (version) do nothing;
