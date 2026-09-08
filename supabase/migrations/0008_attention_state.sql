-- "Needs Attention" items themselves are computed at read time from existing
-- tables (egg_production/health_records/mortality_records/feeds/vitamins/
-- profiles already carry the status/threshold columns needed) — this table
-- holds only the one thing that can't be derived: each user's own
-- read/dismiss interaction with a given item.
create table if not exists public.attention_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null,
  reference_id text not null,
  is_read boolean not null default false,
  dismissed boolean not null default false,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module, reference_id)
);

alter table public.attention_state enable row level security;

drop policy if exists "Users manage their own attention state" on public.attention_state;
create policy "Users manage their own attention state" on public.attention_state
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists set_attention_state_updated_at on public.attention_state;
create trigger set_attention_state_updated_at
  before update on public.attention_state
  for each row execute procedure public.handle_updated_at();

insert into public.schema_migrations (version) values ('0008_attention_state')
on conflict (version) do nothing;
