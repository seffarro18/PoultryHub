-- PoultryHub — migration 0012: notify Farm Admin/Manager when Staff submits
-- a new egg production record.
--
-- The egg production module already notifies Staff back when their record
-- is reviewed (notify_egg_production_reviewed(), 0010) and flags unusually
-- low approved totals (notify_low_egg_production(), 0001_03) — but nothing
-- told the Farm Admin/Manager a new record was even waiting for review. This
-- adds the missing leg, following the exact template already used for the
-- other Staff-submits-a-record modules (notify_health_case_submitted() /
-- notify_mortality_case_submitted(), 0001_06): an `after insert` trigger,
-- gated by notification_settings, fanned out to the farm's Farm Admin/
-- Manager. No separate dedup check is needed here (unlike
-- notify_low_egg_production()'s daily guard) — this fires once per inserted
-- row, which is inherently one notification per submission.

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in (
  'low_feed_stock', 'low_vitamin_stock', 'low_inventory', 'mortality_alert', 'new_user_registration',
  'system_update', 'security_alert', 'backup_completion', 'failed_login_attempt',
  'expiring_medicine', 'low_egg_production', 'new_staff_account',
  'feed_schedule_reminder', 'vaccination_reminder', 'production_reminder', 'task_assignment',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
  'task_assigned', 'task_comment_added', 'task_problem_reported', 'task_completed',
  'egg_production_submitted'
));

alter table public.notification_settings drop constraint if exists notification_settings_category_check;
alter table public.notification_settings add constraint notification_settings_category_check check (category in (
  'new_user_registration', 'new_staff_account', 'mortality_alert', 'low_inventory',
  'low_egg_production', 'low_feed_stock', 'low_vitamin_stock', 'expiring_medicine',
  'disease_outbreak', 'mortality_threshold_exceeded', 'health_case_submitted', 'mortality_case_submitted',
  'egg_production_reviewed', 'health_record_reviewed', 'mortality_record_reviewed',
  'task_assigned', 'task_comment_added', 'task_problem_reported', 'task_completed',
  'egg_production_submitted'
));

insert into public.notification_settings (category) values ('egg_production_submitted')
on conflict (category) do nothing;

create or replace function public.notify_egg_production_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_staff_name text;
begin
  if new.status = 'pending'
     and coalesce((select enabled from public.notification_settings where category = 'egg_production_submitted'), true)
  then
    select name into v_staff_name from public.profiles where id = new.recorded_by;

    insert into public.notifications (recipient_id, farm_id, category, severity, title, message, link)
    select id, new.farm_id, 'egg_production_submitted', 'info', 'New Egg Production Record',
           coalesce(v_staff_name, 'A staff member') || ' recorded today''s egg collection (' || new.house_pen || ', ' ||
             new.eggs_collected || ' eggs).',
           '/farm/egg-production'
    from public.profiles
    where farm_id = new.farm_id and role in ('Farm Admin', 'Manager');
  end if;
  return new;
end;
$$;

drop trigger if exists on_egg_production_submitted_notify on public.egg_production;
create trigger on_egg_production_submitted_notify
  after insert on public.egg_production
  for each row execute procedure public.notify_egg_production_submitted();

insert into public.schema_migrations (version) values ('0012_egg_production_submitted_notify')
on conflict (version) do nothing;
