-- TownSteel Social Planner: database setup
-- Paste all of this into Supabase > SQL Editor > New query, then click Run.
-- It creates one table that holds each user's planner, and rules so
-- a signed-in user can only see and change their own planner.

create table if not exists public.planner_state (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  version    bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.planner_state enable row level security;

drop policy if exists "Read own planner" on public.planner_state;
drop policy if exists "Create own planner" on public.planner_state;
drop policy if exists "Update own planner" on public.planner_state;

create policy "Read own planner" on public.planner_state
  for select to authenticated using (auth.uid() = user_id);

create policy "Create own planner" on public.planner_state
  for insert to authenticated with check (auth.uid() = user_id);

create policy "Update own planner" on public.planner_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.planner_state to authenticated;
