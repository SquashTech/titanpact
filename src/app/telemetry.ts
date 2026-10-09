// Play data for playtesting: one row per Classic run, sent to Supabase (docs/telemetry.md).
// The fight log rides localStorage beside the save, so a reloaded run keeps its fights; a
// finished run goes to an outbox and leaves only once the server has it, so offline play
// sends on the next launch.

// Blank = telemetry off. The anon key is public by design; the table's policy only allows insert.
const SUPABASE_URL: string = 'https://iojeparerflkdtmtppbj.supabase.co';
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvamVwYXJlcmZsa2R0bXRwcGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1Njc4NDYsImV4cCI6MjEwNzE0Mzg0Nn0.OLdTgrBElDjSQYi6M8BvZnpuSgabIBO85meweSNlRvs';

const PLAYER_KEY = 'titanpact.telemetry.player';
const RUN_KEY = 'titanpact.telemetry.run';
const OUTBOX_KEY = 'titanpact.telemetry.outbox';
const OUTBOX_CAP = 50;

export interface FightLog {
  act: number;
  node: string;
  outcome: 'win' | 'loss';
  rounds: number | null;
  /** The player's heroes knocked out at the fight's end. */
  playerKos: number;
  roster: { heroId: string; level: number }[];
  enemies: string[];
}

interface RunLog {
  runId: string;
  startedAt: number;
  cycle: number;
  drafted: string[];
  fights: FightLog[];
}

export interface RunSummary {
  outcome: 'win' | 'loss';
  cycle: number;
  actReached: number;
  encountersWon: number;
  durationMs: number | null;
  locationIds: string[];
  roster: { heroId: string; level: number; evolutionPathId: string | null; curseId?: string | null }[];
  companionType: string | null;
}

const enabled = (): boolean => SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage unavailable — this run goes unrecorded. */
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function playerId(): string {
  const held = read<string>(PLAYER_KEY);
  if (held) return held;
  const id = newId();
  write(PLAYER_KEY, id);
  return id;
}

/** The pact sealed. A log still open from a run never finished goes out as abandoned. */
export function telemetryRunStarted(cycle: number, drafted: readonly string[]): void {
  if (!enabled()) return;
  const stale = read<RunLog>(RUN_KEY);
  if (stale) enqueue(rowFor(stale, null));
  write(RUN_KEY, { runId: newId(), startedAt: Date.now(), cycle, drafted: [...drafted], fights: [] } satisfies RunLog);
  void flushTelemetry();
}

export function telemetryFight(fight: FightLog): void {
  if (!enabled()) return;
  const log = read<RunLog>(RUN_KEY);
  if (!log) return;
  write(RUN_KEY, { ...log, fights: [...log.fights, fight] });
}

export function telemetryRunEnded(summary: RunSummary): void {
  if (!enabled()) return;
  const log = read<RunLog>(RUN_KEY);
  if (!log) return;
  write(RUN_KEY, null);
  enqueue(rowFor(log, summary));
  void flushTelemetry();
}

function rowFor(log: RunLog, summary: RunSummary | null): Record<string, unknown> {
  const lastAct = log.fights.length > 0 ? log.fights[log.fights.length - 1].act : 1;
  return {
    player_id: playerId(),
    run_id: log.runId,
    build: __BUILD_SHA__,
    started_at: new Date(log.startedAt).toISOString(),
    outcome: summary?.outcome ?? 'abandoned',
    cycle: summary?.cycle ?? log.cycle,
    act_reached: summary?.actReached ?? lastAct,
    encounters_won: summary?.encountersWon ?? log.fights.filter((fight) => fight.outcome === 'win').length,
    duration_ms: summary?.durationMs ?? null,
    location_ids: summary?.locationIds ?? null,
    drafted: log.drafted,
    roster: summary?.roster ?? null,
    companion_type: summary?.companionType ?? null,
    fights: log.fights,
  };
}

function enqueue(row: Record<string, unknown>): void {
  const outbox = read<Record<string, unknown>[]>(OUTBOX_KEY) ?? [];
  write(OUTBOX_KEY, [...outbox, row].slice(-OUTBOX_CAP));
}

let flushing = false;

/** Sends whatever is waiting, oldest first, stopping at the first row the server has not taken. */
export async function flushTelemetry(): Promise<void> {
  if (!enabled() || flushing) return;
  flushing = true;
  try {
    for (;;) {
      const outbox = read<Record<string, unknown>[]>(OUTBOX_KEY) ?? [];
      if (outbox.length === 0) return;
      let res: Response;
      try {
        res = await fetch(`${SUPABASE_URL}/rest/v1/runs`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(outbox[0]),
        });
      } catch {
        return;
      }
      // 409: the run_id is already in — an earlier send landed but its reply was lost. 400/422: a
      // malformed row. Anything else (a bad key, a missing table, the server down) waits.
      if (!res.ok && res.status !== 409 && res.status !== 400 && res.status !== 422) return;
      write(OUTBOX_KEY, (read<Record<string, unknown>[]>(OUTBOX_KEY) ?? []).slice(1));
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => void flushTelemetry());
