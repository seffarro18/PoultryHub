-- Adds Priority and Poultry House/Pen to tasks — both optional context on an
-- existing task, not new entities. Priority is a plain check-constrained
-- text column (same style as every other small fixed-choice column in this
-- schema, e.g. mortality_records.cause_of_death) rather than a new enum
-- type, since it's only ever read back as-is, never joined on. House/Pen is
-- free text (matching mortality_records.house_pen / feed_distribution.house_pen),
-- not a poultry_houses foreign key — a task can reference a pen loosely
-- without requiring one to already be configured.

alter table public.tasks
  add column if not exists priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high'));

alter table public.tasks
  add column if not exists house_pen text;

insert into public.schema_migrations (version) values ('0020_task_priority_house_pen')
on conflict (version) do nothing;
