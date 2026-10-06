-- schema_migrations was created without RLS (0001_01_users_auth.sql) — low
-- sensitivity (just version/timestamp bookkeeping, no personal or farm
-- data), but any table exposed through PostgREST without RLS is queryable
-- by any authenticated caller by default, which is unintentional here: this
-- table is meant to be read only by hand, via the Supabase SQL Editor (which
-- bypasses PostgREST/RLS entirely), never by the app itself. Enabling RLS
-- with zero policies is the standard "no API access, SQL Editor still works"
-- pattern — it doesn't break the workflow AGENTS.md describes.
alter table public.schema_migrations enable row level security;

insert into public.schema_migrations (version) values ('0009_schema_migrations_rls')
on conflict (version) do nothing;
