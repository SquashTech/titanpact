# Telemetry — playtest data

Friends-only for now (2026-10-09, per user direction). One row per **Classic** run goes to a
Supabase table; Gauntlet and Trials are not recorded. Nothing personal is collected: a player is a
random id made on first launch and kept in localStorage.

## What a row holds

`player_id`, `run_id`, `build` (the commit the deployed build came from, `dev` locally),
`outcome` (`win` / `loss` / `abandoned`), `cycle`, `act_reached`, `encounters_won`, `duration_ms`
(foreground playtime, the Records screen's figure), `location_ids`, `drafted` (the four drafted),
`roster` (the end roster: hero, level, path, curse), `companion_type`, and `fights` — one entry
per fight: act, node kind, outcome, rounds, the player's KOs at the end, the roster with levels,
and the enemy hero ids.

**Abandoned** is a run whose log was still open when the next pact was sealed; it carries its
fights but no end roster.

## How it moves

`src/app/telemetry.ts`. The run's fight log lives in localStorage beside the save, so a reload
keeps it. A finished run goes into an outbox (cap 50) and leaves only once Supabase accepts it,
so offline play sends on the next title screen or when the device comes back online. A bad key
or a missing table holds the rows rather than losing them.

Blank `SUPABASE_URL` / `SUPABASE_ANON_KEY` at the top of that file = telemetry off.

## Setup (once)

1. Create a free project at supabase.com.
2. SQL editor → paste `scripts/telemetry/schema.sql` → Run.
3. Project Settings → API: copy the **Project URL** and the **anon public** key into the two
   constants in `src/app/telemetry.ts`, commit, push. The anon key is meant to be public: the
   table's policy lets it insert and read nothing.
4. Keep the **service_role** key secret — it is only for the report.

## Reading it

```bash
SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_KEY=<service_role key> npm run telemetry
```

Needs Node 18+ (the pinned `.node-runtime` one; the system Node 14 has no `fetch`). Prints players, clear rate, median run length, fights by act and node (lost, rounds, KOs), draft
pick and clear rates, and the enemies most present in lost fights. `-- --build <sha>` reads one
build. Raw rows are also browsable in Supabase's Table Editor.

## Open

- **Going public** needs an opt-in and a privacy note before this ships to strangers.
- The insert-only key can be spammed by anyone who reads the bundle; fine for friends.
