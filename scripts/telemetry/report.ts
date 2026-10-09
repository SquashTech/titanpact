// Reads every playtest run off Supabase and prints the tables the sim report prints, for real play.
// SUPABASE_URL and SUPABASE_SERVICE_KEY (the secret key — never commit it) in the environment.
// Optional: --build <sha> to read one build only. docs/telemetry.md.

interface Fight {
  act: number;
  node: string;
  outcome: 'win' | 'loss';
  rounds: number | null;
  playerKos: number;
  roster: { heroId: string; level: number }[];
  enemies: string[];
}

interface Row {
  player_id: string;
  build: string;
  outcome: 'win' | 'loss' | 'abandoned';
  cycle: number;
  act_reached: number;
  duration_ms: number | null;
  drafted: string[];
  fights: Fight[];
}

const pct = (n: number, d: number): string => (d === 0 ? '—' : `${((100 * n) / d).toFixed(0)}%`);
const pad = (s: string | number, w: number): string => String(s).padEnd(w);

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  const buildArg = process.argv.indexOf('--build');
  const build = buildArg >= 0 ? process.argv[buildArg + 1] : null;

  const query = `select=*&order=received_at.asc${build ? `&build=eq.${encodeURIComponent(build)}` : ''}`;
  const res = await fetch(`${url}/rest/v1/runs?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as Row[];

  const finished = rows.filter((row) => row.outcome !== 'abandoned');
  const wins = finished.filter((row) => row.outcome === 'win').length;
  console.log(`${rows.length} runs from ${new Set(rows.map((row) => row.player_id)).size} players${build ? ` on ${build}` : ''}`);
  console.log(`finished ${finished.length} · cleared ${wins} (${pct(wins, finished.length)}) · abandoned ${rows.length - finished.length}`);
  const durations = finished.map((row) => row.duration_ms).filter((ms): ms is number => ms !== null).sort((a, b) => a - b);
  if (durations.length > 0) console.log(`median run ${(durations[Math.floor(durations.length / 2)] / 60000).toFixed(0)} min`);

  console.log('\nBy player');
  const players = new Map<string, Row[]>();
  for (const row of rows) players.set(row.player_id, [...(players.get(row.player_id) ?? []), row]);
  for (const [id, own] of players) {
    const done = own.filter((row) => row.outcome !== 'abandoned');
    console.log(`  ${pad(id.slice(0, 8), 10)} runs ${pad(own.length, 4)} cleared ${pad(pct(done.filter((row) => row.outcome === 'win').length, done.length), 5)} best act ${Math.max(...own.map((row) => row.act_reached))}`);
  }

  console.log('\nFights by act and node      fought  lost   avg rounds  avg KOs');
  const fights = rows.flatMap((row) => row.fights);
  const byNode = new Map<string, Fight[]>();
  for (const fight of fights) {
    const k = `act ${fight.act} ${fight.node}`;
    byNode.set(k, [...(byNode.get(k) ?? []), fight]);
  }
  for (const [k, group] of [...byNode].sort(([a], [b]) => a.localeCompare(b))) {
    const lost = group.filter((fight) => fight.outcome === 'loss').length;
    const rounds = group.map((fight) => fight.rounds).filter((r): r is number => r !== null);
    const avgRounds = rounds.length ? (rounds.reduce((a, b) => a + b, 0) / rounds.length).toFixed(1) : '—';
    const avgKos = (group.reduce((a, fight) => a + fight.playerKos, 0) / group.length).toFixed(1);
    console.log(`  ${pad(k, 26)} ${pad(group.length, 7)} ${pad(`${lost} (${pct(lost, group.length)})`, 9)} ${pad(avgRounds, 11)} ${avgKos}`);
  }

  console.log('\nHeroes drafted              picked  cleared');
  const drafted = new Map<string, { picked: number; won: number; finished: number }>();
  for (const row of rows) {
    for (const heroId of row.drafted) {
      const tally = drafted.get(heroId) ?? { picked: 0, won: 0, finished: 0 };
      tally.picked += 1;
      if (row.outcome !== 'abandoned') tally.finished += 1;
      if (row.outcome === 'win') tally.won += 1;
      drafted.set(heroId, tally);
    }
  }
  for (const [heroId, tally] of [...drafted].sort((a, b) => b[1].picked - a[1].picked)) {
    console.log(`  ${pad(heroId, 26)} ${pad(tally.picked, 7)} ${pct(tally.won, tally.finished)}`);
  }

  console.log('\nEnemies in fights the player lost');
  const killers = new Map<string, number>();
  for (const fight of fights.filter((f) => f.outcome === 'loss')) {
    for (const heroId of fight.enemies) killers.set(heroId, (killers.get(heroId) ?? 0) + 1);
  }
  for (const [heroId, n] of [...killers].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${pad(heroId, 26)} ${n}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
