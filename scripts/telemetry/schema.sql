-- Paste into the Supabase SQL editor once. docs/telemetry.md.
create table if not exists public.runs (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  player_id text not null,
  run_id text not null unique,
  build text not null,
  started_at timestamptz,
  outcome text not null check (outcome in ('win', 'loss', 'abandoned')),
  cycle int not null,
  act_reached int not null,
  encounters_won int not null,
  duration_ms bigint,
  location_ids jsonb,
  drafted jsonb not null,
  roster jsonb,
  companion_type text,
  fights jsonb not null,
  check (octet_length(fights::text) < 200000)
);

alter table public.runs enable row level security;

-- The game holds only the public anon key: it can add rows and read nothing back.
drop policy if exists "game inserts runs" on public.runs;
create policy "game inserts runs" on public.runs for insert to anon with check (true);
