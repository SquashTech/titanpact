import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { moves } from '../src/data/moves';
import { locations } from '../src/data/locations';
import { typeChart } from '../src/data/typechart';
import { progressionTable } from '../src/data/progression';
import {
  TUTORIAL_ENCOUNTERS,
  TUTORIAL_FIGHT_CUES,
  TUTORIAL_PAYOUTS,
  TUTORIAL_SCRIPT,
} from '../src/data/tutorial';
import { MAP_NODE_TYPES } from '../src/run/map';
import { generateEncounter } from '../src/run/enemyGen';
import { costToReachLevel } from '../src/run/progression';
import { EVOLUTION_LEVEL } from '../src/run/progression';
import { createRunState } from '../src/run/state';
import { resolveTypeMult } from '../src/engine/damage/typeMult';
import {
  generateTutorialMap,
  isTutorialAct,
  mapBeatKey,
  markTutorialBeatSeen,
  matchTutorialCue,
  normalizeLine,
  rewardBeatKey,
  tutorialBeat,
  tutorialEncounterFor,
  tutorialPayoutFor,
  TUTORIAL_ROW_TYPES,
  TUTORIAL_SCREEN_BEAT_KEYS,
  TUTORIAL_STARTER_IDS,
  type TutorialFightContext,
} from '../src/run/tutorial';

const tutorialRun = () => ({ ...createRunState(), tutorial: true, map: generateTutorialMap(1) });

// --- The curated map ---

test('tutorial: the map is a corridor — one node per row, every row reachable, boss last', () => {
  const map = generateTutorialMap(1);

  assert.strictEqual(map.rows.length, TUTORIAL_ROW_TYPES.length);
  for (const row of map.rows) assert.strictEqual(row.length, 1, 'every tutorial row offers exactly one node');

  assert.deepStrictEqual(
    map.rows.map((row) => map.nodes[row[0]].type),
    [...TUTORIAL_ROW_TYPES]
  );

  // Each node leads to exactly the next one, and the boss leads nowhere.
  map.rows.forEach((row, index) => {
    const expected = index + 1 < map.rows.length ? [map.rows[index + 1][0]] : [];
    assert.deepStrictEqual(map.nodes[row[0]].nextIds, expected);
  });

  assert.deepStrictEqual(map.startNodeIds, [map.rows[0][0]]);
  assert.strictEqual(map.nodes[map.bossNodeId].type, 'boss');
});

test('tutorial: the corridor teaches each mechanic exactly once — no node type repeats', () => {
  const seen = new Set(TUTORIAL_ROW_TYPES);
  assert.strictEqual(seen.size, TUTORIAL_ROW_TYPES.length, 'a repeated node type would make `map:<type>` ambiguous');
  for (const type of TUTORIAL_ROW_TYPES) assert.ok(MAP_NODE_TYPES.includes(type), `${type} is a real node type`);
});

// --- The forced pact ---

test('tutorial: the forced starters are Valor and Fang, and both are draftable starters', () => {
  assert.deepStrictEqual([...TUTORIAL_STARTER_IDS], ['valor', 'packAlpha']);
  for (const id of TUTORIAL_STARTER_IDS) {
    assert.ok(heroes[id], `${id} is a real hero`);
    assert.strictEqual(heroes[id].starter, true, `${id} must be a starter — the draft screen only offers those`);
  }
});

// --- Curated encounters ---

test('tutorial: every scripted encounter names real content from the pool its node draws', () => {
  for (const [nodeType, encounter] of Object.entries(TUTORIAL_ENCOUNTERS)) {
    assert.ok(encounter && encounter.heroIds.length > 0, `${nodeType} scripts at least one enemy`);
    // fight/battle draw the monster table; skirmish/boss the recruitable hero pool.
    const pool = nodeType === 'fight' || nodeType === 'battle' ? enemies : heroes;
    for (const id of encounter.heroIds) {
      assert.ok(pool[id], `${nodeType} names ${id}, which is not in the pool that node draws from`);
    }
  }
});

test('tutorial: the scripted Skirmish is recruitable and answers the Guardian', () => {
  const skirmish = TUTORIAL_ENCOUNTERS.skirmish!;
  const guardian = enemies[locations.wildsEdge.guardianFinalEnemyId!];

  for (const id of skirmish.heroIds) {
    // Claimable: a Recruit Contract only fires on the recruitable hero pool.
    assert.ok(heroes[id], `${id} must be a hero for the contract lesson to be possible`);
    // The whole shape of the act: what beats you is what beats the thing at the end of it.
    const intoGuardian = resolveTypeMult(typeChart, heroes[id].types[0], guardian.types);
    const intoStarters = TUTORIAL_STARTER_IDS.map((s) => resolveTypeMult(typeChart, heroes[id].types[0], heroes[s].types));
    assert.ok(intoGuardian >= 1, `${id} should not be resisted by the Guardian — it is the recruit the act points at`);
    assert.ok(Math.max(...intoStarters) > 1, `${id} should threaten Valor or Fang — that is the lesson it teaches`);
  }
});

test('tutorial: the Guardian escorts are one super-effective target each for Valor and Fang', () => {
  const escorts = TUTORIAL_ENCOUNTERS.boss!.heroIds;
  for (const starterId of TUTORIAL_STARTER_IDS) {
    const attacker = heroes[starterId].types[0];
    const best = Math.max(...escorts.map((id) => resolveTypeMult(typeChart, attacker, heroes[id].types)));
    assert.ok(best > 1, `${starterId} needs an escort its own domain is strong against — "one is mine, one is yours"`);
  }
});

test('tutorial: a scripted enemy the player already recruited is dropped and the fight refilled', () => {
  const scripted = TUTORIAL_ENCOUNTERS.boss!.heroIds;
  const encounter = generateEncounter('boss', 99, heroes, {
    forcedHeroIds: scripted,
    excludeHeroIds: [scripted[0]],
    progression: progressionTable,
  });
  const fielded = encounter.run.roster.map((entry) => entry.heroId);

  assert.strictEqual(fielded.length, scripted.length, 'the fight stays the size the script was written against');
  assert.ok(!fielded.includes(scripted[0]), 'a hero on the roster is never fielded against the player');
  assert.ok(fielded.includes(scripted[1]), 'the rest of the script is untouched');
});

test('tutorial: a scripted encounter is fielded verbatim when nothing is excluded', () => {
  const scripted = TUTORIAL_ENCOUNTERS.skirmish!.heroIds;
  const encounter = generateEncounter('fight', 5, heroes, { forcedHeroIds: scripted });
  assert.deepStrictEqual(encounter.run.roster.map((e) => e.heroId), [...scripted]);
});

// --- Payouts ---

test('tutorial: Act 1 pays enough to reach an Evolution before the Guardian', () => {
  const beforeGuardian = (['fight', 'skirmish', 'battle'] as const).reduce(
    (total, node) => total + (TUTORIAL_PAYOUTS[node]?.xp ?? 0),
    0
  );
  // The Evolution beat is the one lesson that cannot be scripted into a screen — the player has
  // to be able to afford it. Following Valor (pour it into one hero) must reach the fork.
  assert.ok(
    beforeGuardian >= costToReachLevel(1, EVOLUTION_LEVEL),
    `Act 1 pays ${beforeGuardian} XP but reaching level ${EVOLUTION_LEVEL} costs ${costToReachLevel(1, EVOLUTION_LEVEL)}`
  );
});

test('tutorial: payouts and encounters apply in Act 1 only', () => {
  const run = tutorialRun();
  assert.ok(isTutorialAct(run));
  assert.ok(tutorialPayoutFor(TUTORIAL_PAYOUTS, run, 'fight'));
  assert.ok(tutorialEncounterFor(TUTORIAL_ENCOUNTERS, run, 'fight'));

  const act2 = { ...run, actNumber: 2 };
  assert.strictEqual(isTutorialAct(act2), false);
  assert.strictEqual(tutorialPayoutFor(TUTORIAL_PAYOUTS, act2, 'fight'), null);
  assert.strictEqual(tutorialEncounterFor(TUTORIAL_ENCOUNTERS, act2, 'fight'), null);

  const normal = { ...run, tutorial: false };
  assert.strictEqual(tutorialEncounterFor(TUTORIAL_ENCOUNTERS, normal, 'fight'), null);
});

// --- The script ---

test('tutorial: every beat id is unique and every line has text', () => {
  const seen = new Set<string>();
  for (const beat of TUTORIAL_SCRIPT) {
    assert.ok(!seen.has(beat.id), `duplicate beat id "${beat.id}" — the second would never play`);
    seen.add(beat.id);
    assert.ok(beat.lines.length > 0, `${beat.id} has no lines`);
    for (const line of beat.lines) {
      const { speaker, text } = normalizeLine(line);
      assert.ok(text.trim().length > 0, `${beat.id} carries an empty line`);
      assert.ok(speaker === 'valor' || speaker === 'fang', `${beat.id} names an unknown speaker`);
    }
  }
});

test('tutorial: every node on the corridor has a beat introducing it', () => {
  const ids = new Set(TUTORIAL_SCRIPT.map((beat) => beat.id));
  for (const type of TUTORIAL_ROW_TYPES) {
    assert.ok(ids.has(mapBeatKey(type)), `nothing explains the ${type} node — add a "${mapBeatKey(type)}" beat`);
  }
});

test('tutorial: every screen App can raise a beat on has one authored', () => {
  const ids = new Set(TUTORIAL_SCRIPT.map((beat) => beat.id));
  for (const key of TUTORIAL_SCREEN_BEAT_KEYS) {
    assert.ok(ids.has(key), `App raises "${key}" but the script has no beat for it`);
  }
});

test('tutorial: no beat is addressed to a moment nothing produces', () => {
  // The failure this catches is silent by construction: a beat keyed to something App never
  // emits simply never plays, and the script has no way to notice.
  const producible = new Set<string>([
    ...TUTORIAL_SCREEN_BEAT_KEYS,
    ...TUTORIAL_ROW_TYPES.map(mapBeatKey),
    ...TUTORIAL_ROW_TYPES.map(rewardBeatKey),
  ]);
  for (const beat of TUTORIAL_SCRIPT) {
    assert.ok(producible.has(beat.id), `beat "${beat.id}" names a moment nothing raises — it would never play`);
  }
});

test('tutorial: the reward beats name reward nodes the corridor actually has', () => {
  for (const beat of TUTORIAL_SCRIPT) {
    if (!beat.id.startsWith('reward:')) continue;
    const type = beat.id.slice('reward:'.length);
    assert.ok(
      TUTORIAL_ROW_TYPES.some((row) => rewardBeatKey(row) === beat.id),
      `"${beat.id}" names ${type}, which is not on the tutorial map`
    );
  }
});

test('tutorial: a beat plays once, and only inside a tutorial run', () => {
  const run = tutorialRun();
  assert.ok(tutorialBeat(TUTORIAL_SCRIPT, run, 'intro'));
  assert.strictEqual(tutorialBeat(TUTORIAL_SCRIPT, { ...run, tutorial: false }, 'intro'), null);
  assert.strictEqual(tutorialBeat(TUTORIAL_SCRIPT, run, null), null);
  assert.strictEqual(tutorialBeat(TUTORIAL_SCRIPT, run, 'no-such-beat'), null);

  const after = markTutorialBeatSeen(run, 'intro');
  assert.strictEqual(tutorialBeat(TUTORIAL_SCRIPT, after, 'intro'), null);
  // Idempotent: a double-fired dismissal must not stack the id.
  assert.deepStrictEqual(markTutorialBeatSeen(after, 'intro').tutorialSeenBeatIds, ['intro']);
});

// --- Mid-fight cues ---

const quietFight: TutorialFightContext = {
  round: 1,
  anyOutOfMana: false,
  lockedIn: false,
  lowestPlayerHpFraction: 1,
  enemyHeroIds: [],
};

test('tutorial: every fight cue belongs to a fight the corridor actually has', () => {
  const seen = new Set<string>();
  for (const cue of TUTORIAL_FIGHT_CUES) {
    assert.ok(!seen.has(cue.id), `duplicate cue id "${cue.id}"`);
    seen.add(cue.id);
    assert.ok(TUTORIAL_ROW_TYPES.includes(cue.node), `${cue.id} is authored for a ${cue.node} node that is not on the map`);
    assert.ok(Object.keys(cue.when).length > 0, `${cue.id} has no condition and would fire on round 1 forever`);
    assert.ok(cue.lines.length > 0, `${cue.id} has no lines`);
  }
});

test('tutorial: a cue named for a hero on the field names a real one', () => {
  const known = { ...heroes, ...enemies };
  for (const cue of TUTORIAL_FIGHT_CUES) {
    if (cue.when.enemyOnField) assert.ok(known[cue.when.enemyOnField], `${cue.id} watches for unknown hero ${cue.when.enemyOnField}`);
  }
});

test('tutorial: cues fire on their own fight, once, in script order', () => {
  const opener = matchTutorialCue(TUTORIAL_FIGHT_CUES, 'fight', quietFight, new Set());
  assert.ok(opener, 'the opener should coach on round 1');
  assert.strictEqual(opener!.node, 'fight');

  // Another node's round 1 must not borrow it.
  const elsewhere = matchTutorialCue(TUTORIAL_FIGHT_CUES, 'shop', quietFight, new Set());
  assert.strictEqual(elsewhere, null);

  // Seen once is seen for good.
  assert.notStrictEqual(matchTutorialCue(TUTORIAL_FIGHT_CUES, 'fight', quietFight, new Set([opener!.id])), opener);
});

test('tutorial: the Rest cue waits until there is nothing left to cast', () => {
  const rest = TUTORIAL_FIGHT_CUES.find((cue) => cue.id === 'fight:rest')!;
  const seen = new Set(TUTORIAL_FIGHT_CUES.filter((cue) => cue.id !== rest.id).map((cue) => cue.id));

  assert.strictEqual(matchTutorialCue(TUTORIAL_FIGHT_CUES, 'fight', { ...quietFight, round: 4 }, seen), null);
  assert.strictEqual(
    matchTutorialCue(TUTORIAL_FIGHT_CUES, 'fight', { ...quietFight, round: 4, anyOutOfMana: true }, seen),
    rest
  );
});

test('tutorial: the Ancient cue waits for the champion to walk on', () => {
  const ancient = TUTORIAL_FIGHT_CUES.find((cue) => cue.id === 'boss:ancient')!;
  const championId = locations.wildsEdge.guardianFinalEnemyId!;
  assert.strictEqual(ancient.when.enemyOnField, championId, 'the cue must watch for the Location its act is set in');

  const seen = new Set(TUTORIAL_FIGHT_CUES.filter((cue) => cue.id !== ancient.id).map((cue) => cue.id));
  assert.strictEqual(matchTutorialCue(TUTORIAL_FIGHT_CUES, 'boss', { ...quietFight, round: 3 }, seen), null);
  assert.strictEqual(
    matchTutorialCue(TUTORIAL_FIGHT_CUES, 'boss', { ...quietFight, round: 3, enemyHeroIds: [championId] }, seen),
    ancient
  );
});

test('tutorial: the scripted opener has no super-effective read to teach, and says so', () => {
  // Guards the fight:types line: it talks about a resist, not a weakness, because the Goblin
  // pool holds nothing Iron or Beast is strong against. If that changes, rewrite the line.
  const opener = TUTORIAL_ENCOUNTERS.fight!.heroIds;
  for (const starterId of TUTORIAL_STARTER_IDS) {
    const attacker = heroes[starterId].types[0];
    const best = Math.max(...opener.map((id) => resolveTypeMult(typeChart, attacker, enemies[id].types)));
    assert.ok(best <= 1, `${starterId} is strong against the opener — the "watch the resist" cue no longer matches`);
  }
});

test('tutorial: the opener still ships the Skulker the equip-inspect fixture arms', () => {
  // App.tsx equipTestDagger hands the first fight's Goblin Skulker a Dagger so the enemy
  // equipment UI has something in it from turn one; the scripted opener must keep him.
  assert.ok(TUTORIAL_ENCOUNTERS.fight!.heroIds.includes('goblinSkulker'));
});

test('tutorial: every move on a scripted enemy exists', () => {
  for (const [nodeType, encounter] of Object.entries(TUTORIAL_ENCOUNTERS)) {
    const pool = nodeType === 'fight' || nodeType === 'battle' ? enemies : heroes;
    for (const id of encounter!.heroIds) {
      for (const moveId of pool[id].moveIds) assert.ok(moves[moveId], `${id} carries unknown move ${moveId}`);
    }
  }
});
