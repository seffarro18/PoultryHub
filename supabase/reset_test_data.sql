-- PoultryHub — one-off development data reset, NOT a schema migration.
-- Not numbered, not recorded in schema_migrations — this touches rows, not
-- schema, and isn't meant to be re-applied as part of the migration chain.
--
-- Wipes transactional/test data back to zero while preserving every piece
-- of system configuration: farms, profiles (all accounts), poultry_houses,
-- egg_prices, production_settings, layer_breeds, notification_settings,
-- roles/permissions, system/smtp/security settings, schema_migrations.
--
-- Also leaves login_history/user_sessions/failed_login_attempts untouched —
-- not part of the requested reset, and clearing user_sessions would log
-- out every currently-signed-in account including your own.
--
-- Order respects FK constraints: feed_distribution/vitamin_administration
-- reference feeds/vitamins with ON DELETE RESTRICT, so they're cleared
-- first. sale_items/purchase_items cascade automatically from
-- sales/purchase_transactions. audit_logs is cleared LAST, after every
-- other delete — each of those deletes fires log_audit_event() and would
-- otherwise repopulate audit_logs with fresh "X deleted" rows.

begin;

delete from public.expenses;
delete from public.purchase_transactions;           -- cascades purchase_items
delete from public.feed_distribution;
delete from public.vitamin_administration;
delete from public.feeds;
delete from public.vitamins;
delete from public.sales;                            -- cascades sale_items
delete from public.egg_production;
delete from public.mortality_records;
delete from public.health_records;
delete from public.poultry_inventory_events;
delete from public.tasks;                             -- cascades task_comments
delete from public.notifications;
delete from public.egg_price_history;
delete from public.attention_state;

-- audit_logs last — see header comment.
delete from public.audit_logs;

-- Cosmetic: new purchase receipts start back at PUR-2026-000001.
alter sequence public.purchase_reference_seq restart with 1;

commit;

-- ── Verify: transactional counts should all be 0 ─────────────────────────
select
  (select count(*) from public.egg_production) as egg_production,
  (select count(*) from public.feeds) as feeds,
  (select count(*) from public.vitamins) as vitamins,
  (select count(*) from public.feed_distribution) as feed_distribution,
  (select count(*) from public.vitamin_administration) as vitamin_administration,
  (select count(*) from public.sales) as sales,
  (select count(*) from public.sale_items) as sale_items,
  (select count(*) from public.expenses) as expenses,
  (select count(*) from public.purchase_transactions) as purchase_transactions,
  (select count(*) from public.purchase_items) as purchase_items,
  (select count(*) from public.tasks) as tasks,
  (select count(*) from public.task_comments) as task_comments,
  (select count(*) from public.notifications) as notifications,
  (select count(*) from public.audit_logs) as audit_logs,
  (select count(*) from public.egg_price_history) as egg_price_history,
  (select count(*) from public.attention_state) as attention_state,
  (select count(*) from public.mortality_records) as mortality_records,
  (select count(*) from public.health_records) as health_records,
  (select count(*) from public.poultry_inventory_events) as poultry_inventory_events;

-- ── Verify: configuration counts should be unchanged ─────────────────────
select
  (select count(*) from public.farms) as farms,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.poultry_houses) as poultry_houses,
  (select count(*) from public.egg_prices) as egg_prices,
  (select count(*) from public.production_settings) as production_settings,
  (select count(*) from public.layer_breeds) as layer_breeds,
  (select count(*) from public.notification_settings) as notification_settings;
