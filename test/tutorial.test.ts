import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies, factions } from '../src/data/enemies';
import { moves } from '../src/data/moves';
import { locations } from '../src/data/locations';
import { typeChart } from '../src/data/typechart';
import { progressionTable } from '../src/data/progression';
import {
  TUTORIAL_ENCOUNTERS,
  TUTORIAL_FIGHT_CUES,
  TUTORIAL_LOCKS,
  TUTORIAL_PAYOUTS,
  TUTORIAL_SCRIPT,
} from '../src/data/tutorial';
import { MAP_NODE_TYPES } from '../src/run/map';
import { generateEncounter } from '../src/run/enemyGen';
import { costToReachLevel, levelUpCost } from '../src/run/progression';
import { EVOLUTION_LEVEL } from '../src/run/progression';
import { createRosterEntry, createRunState } from '../src/run/state';
import { resolveTypeMult } from '../src/engine/damage/typeMult';
import { calcDamage, VARIANCE_MAX, statKeysForMove } from '../src/engine/damage/damagePipeline';
import { HP_SCALE } from '../src/engine/state';
import {
  cueNodes,
  generateTutorialMap,
  isTutorialAct,
  mapBeatKey,
  markTutorialBeatSeen,
  matchTutorialCue,
  normalizeLine,
  parseTutorialText,
  rewardBeatKey,
  tutorialBeat,
  tutorialContractOffers,
  tutorialEncounterFor,
  tutorialFocusRosterId,
  tutorialLockedActiveRosterIds,
  tutorialPayoutFor,
  TUTORIAL_ROW_TYPES,
  TUTORIAL_SCREEN_BEAT_KEYS,
  TUTORIAL_ICON_TOKENS,
  TUTORIAL_STARTER_IDS,
  unknownIconTokens,
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
    // Only the Skirmish draws the recruitable hero pool; fight/battle/boss are all faction content.
    const pool = nodeType === 'skirmish' ? heroes : enemies;
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

test('tutorial: the scripted Guardian is shaped like every other Guardian', () => {
  // The tutorial must not teach a fight the rest of the run never presents. Since 2026-09-06 a
  // `boss` fields two of the Location faction's own BASICS with its champion on the bench
  // (run-loop.md "The Guardian's escorts"), so the scripted one has to draw from that same list.
  const faction = factions[locations.wildsEdge.factionId];
  for (const id of TUTORIAL_ENCOUNTERS.boss!.heroIds) {
    assert.ok(
      faction.basicIds.includes(id),
      `${id} is not a Wild's Edge basic — a scripted Guardian must field what a real one fields`
    );
  }
  assert.strictEqual(TUTORIAL_ENCOUNTERS.boss!.heroIds.length, 2, 'a Guardian fields two escorts');
  // And the champion behind them is the Location's, not something the script invented.
  assert.ok(enemies[locations.wildsEdge.guardianFinalEnemyId!], 'the Location must name a champion for the bench');
});

test('tutorial: a scripted enemy the player already recruited is dropped and the fight refilled', () => {
  const scripted = TUTORIAL_ENCOUNTERS.skirmish!.heroIds;
  const encounter = generateEncounter('fight', 99, heroes, {
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
  const scripted = TUTORIAL_ENCOUNTERS.boss!.heroIds;
  const encounter = generateEncounter('boss', 5, enemies, { forcedHeroIds: scripted });
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
    for (const node of cueNodes(cue)) {
      assert.ok(TUTORIAL_ROW_TYPES.includes(node), `${cue.id} is authored for a ${node} node that is not on the map`);
    }
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
    const pool = nodeType === 'skirmish' ? heroes : enemies;
    for (const id of encounter!.heroIds) {
      for (const moveId of pool[id].moveIds) assert.ok(moves[moveId], `${id} carries unknown move ${moveId}`);
    }
  }
});

// --- Locks: the choices the scripted act takes away ---

/** A tutorial run holding `heroIds`, each as a fresh level-1 entry. */
function lockRun(heroIds: readonly string[]) {
  const run = tutorialRun();
  return { ...run, roster: heroIds.map((id) => createRosterEntry(id, id, heroes[id].moveIds)) };
}

test('tutorial: the forced recruit is a MAGICAL specialist that actually shows up to be claimed', () => {
  const hero = heroes[TUTORIAL_LOCKS.recruitHeroId];
  assert.ok(hero, 'the forced recruit must be a real hero');
  assert.ok(
    TUTORIAL_ENCOUNTERS.skirmish!.heroIds.includes(TUTORIAL_LOCKS.recruitHeroId),
    'the forced recruit must be on the Skirmish it is claimed from'
  );

  // The whole reason this lock exists: the two damage pipelines are invisible until the player
  // owns one of each, and a magical hero has to read as unambiguously magical to teach it.
  const { attack, intelligence } = hero.baseStats;
  assert.ok(intelligence > attack, `${hero.name} must lead on Intelligence to teach the magical pipeline`);
  const damage = hero.moveIds.map((id) => moves[id]).filter((m) => m.kind === 'damage');
  assert.ok(damage.length > 0 && damage.every((m) => m.category === 'magical'), `${hero.name} must swing magical, not physical`);
});

test('tutorial: the forced caster out-damages both starters against the Guardian she is pinned to', () => {
  // The whole reason the recruit and the fielding lock exist. Nothing is staged for it: the
  // Goblin Lord is authored at 75 Defense against 60 Wisdom, so the two pipelines read
  // differently on him, and the caster wins WITHOUT being strong against him — the seal halves
  // her too. Computed on base kits, because the player's Evolution is their own choice.
  const lord = enemies[locations.wildsEdge.guardianFinalEnemyId!];

  const bestAgainstLord = (heroId: string) => {
    const hero = heroes[heroId];
    return Math.max(
      0,
      ...hero.moveIds
        .map((id) => moves[id])
        .filter((move) => move.kind === 'damage')
        .map((move) => {
          const [offStat, defStat] = statKeysForMove(move);
          const ratio = hero.baseStats[offStat] / lord.baseStats[defStat];
          return calcDamage(move, ratio, hero.types, lord.types, typeChart, VARIANCE_MAX, false).damage;
        })
    );
  };

  const caster = bestAgainstLord(TUTORIAL_LOCKS.recruitHeroId);
  for (const starterId of TUTORIAL_STARTER_IDS) {
    assert.ok(
      caster > bestAgainstLord(starterId),
      `${heroes[TUTORIAL_LOCKS.recruitHeroId].name} reads ${Math.round(caster)} against the Lord and ` +
        `${heroes[starterId].name} reads ${Math.round(bestAgainstLord(starterId))} — the lock has nothing to prove`
    );
  }
  assert.ok(TUTORIAL_LOCKS.fieldAtNodes.includes('boss'), 'the caster must be on the field for the fight that proves it');
  for (const node of TUTORIAL_LOCKS.fieldAtNodes) {
    assert.ok(TUTORIAL_ROW_TYPES.includes(node), `${node} is not on the tutorial map`);
  }
});

test('tutorial: the contract offer is forced once, and only while it is claimable', () => {
  const run = lockRun([...TUTORIAL_STARTER_IDS]);
  const beaten = TUTORIAL_ENCOUNTERS.skirmish!.heroIds.map((id) => createRosterEntry(id, id, heroes[id].moveIds));

  const forced = tutorialContractOffers(TUTORIAL_LOCKS, run, beaten);
  assert.ok(forced, 'the Skirmish must force its contract');
  assert.deepStrictEqual(forced!.map((e) => e.heroId), [TUTORIAL_LOCKS.recruitHeroId], 'exactly one offer, and it is the caster');

  // Already owned — nothing left to force, so the screen goes back to being skippable.
  const owned = lockRun([...TUTORIAL_STARTER_IDS, TUTORIAL_LOCKS.recruitHeroId]);
  assert.strictEqual(tutorialContractOffers(TUTORIAL_LOCKS, owned, beaten), null);

  // Not among the beaten (any other fight), and outside the scripted act.
  assert.strictEqual(tutorialContractOffers(TUTORIAL_LOCKS, run, []), null);
  assert.strictEqual(tutorialContractOffers(TUTORIAL_LOCKS, { ...run, actNumber: 2 }, beaten), null);
  assert.strictEqual(tutorialContractOffers(TUTORIAL_LOCKS, { ...run, tutorial: false }, beaten), null);
});

test('tutorial: the Level Up focus lock holds until the focus hero evolves, then lifts', () => {
  const run = lockRun([...TUTORIAL_STARTER_IDS]);
  const focusEntry = run.roster.find((r) => r.heroId === TUTORIAL_LOCKS.focusHeroId)!;
  assert.strictEqual(tutorialFocusRosterId(TUTORIAL_LOCKS, run), focusEntry.rosterId);

  const evolved = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === focusEntry.rosterId ? { ...r, chosenPathIds: ['whatever'] } : r)),
  };
  assert.strictEqual(tutorialFocusRosterId(TUTORIAL_LOCKS, evolved), null, 'the lock exists to reach an Evolution, so taking one ends it');

  assert.strictEqual(tutorialFocusRosterId(TUTORIAL_LOCKS, { ...run, actNumber: 2 }), null);
  assert.strictEqual(tutorialFocusRosterId(TUTORIAL_LOCKS, { ...run, tutorial: false }), null);
  assert.strictEqual(tutorialFocusRosterId(TUTORIAL_LOCKS, lockRun(['packAlpha'])), null, 'no focus hero, no lock');
});

test('tutorial: the focus lock reaches the Evolution on the payouts as written', () => {
  // The lock only guarantees the fork if the schedule pays for it. Walk Act 1's income against
  // the level price with every point going to the focus hero, and check where level 5 lands.
  let pool = 0;
  let level = 1;
  const reachedAfter: string[] = [];
  for (const node of ['fight', 'skirmish', 'battle'] as const) {
    pool += TUTORIAL_PAYOUTS[node]?.xp ?? 0;
    while (level < EVOLUTION_LEVEL && pool >= levelUpCost(level)) {
      pool -= levelUpCost(level);
      level++;
    }
    if (level >= EVOLUTION_LEVEL) reachedAfter.push(node);
  }
  assert.ok(reachedAfter.length > 0, 'Act 1 never reaches the Evolution even with every point on one hero');
  assert.strictEqual(reachedAfter[0], 'skirmish', 'the Evolution should land on the Skirmish level-up, beside the forced recruit');
});

test('tutorial: the field lock pins the caster at its nodes and nowhere else', () => {
  const run = lockRun([...TUTORIAL_STARTER_IDS, TUTORIAL_LOCKS.recruitHeroId]);
  const pinned = run.roster.find((r) => r.heroId === TUTORIAL_LOCKS.fieldHeroId)!;

  for (const node of TUTORIAL_LOCKS.fieldAtNodes) {
    assert.deepStrictEqual([...tutorialLockedActiveRosterIds(TUTORIAL_LOCKS, run, node)], [pinned.rosterId]);
  }
  assert.deepStrictEqual([...tutorialLockedActiveRosterIds(TUTORIAL_LOCKS, run, 'skirmish')], []);
  assert.deepStrictEqual([...tutorialLockedActiveRosterIds(TUTORIAL_LOCKS, { ...run, actNumber: 2 }, 'boss')], []);

  // Never strands the screen: a hero the player does not have cannot be required to stand.
  const without = lockRun([...TUTORIAL_STARTER_IDS]);
  assert.deepStrictEqual([...tutorialLockedActiveRosterIds(TUTORIAL_LOCKS, without, 'boss')], []);
});

// --- The opener has to survive its own dialogue ---

test('tutorial: no starter can one-shot an opener enemy, so a round-2 cue has somewhere to land', () => {
  // The bug this pins: the Goblins are authored as fodder, and fodder dies in round 1 — which
  // took every round-2 lesson with it. Computed through the real damage pipeline at MAXIMUM
  // variance (the fastest possible kill) and against the grants the scripted opener carries.
  const opener = TUTORIAL_ENCOUNTERS.fight!;
  const grants = opener.statGrants ?? {};

  for (const enemyId of opener.heroIds) {
    const enemy = enemies[enemyId];
    const effectiveHp = (enemy.baseStats.hp + (grants.hp ?? 0)) * HP_SCALE;

    for (const starterId of TUTORIAL_STARTER_IDS) {
      const hero = heroes[starterId];
      for (const moveId of hero.moveIds) {
        const move = moves[moveId];
        if (move.kind !== 'damage') continue;
        const [offStat, defStat] = statKeysForMove(move);
        const ratio = hero.baseStats[offStat] / (enemy.baseStats[defStat] + (grants[defStat] ?? 0));
        const { damage } = calcDamage(move, ratio, hero.types, enemy.types, typeChart, VARIANCE_MAX, false);

        assert.ok(
          damage < effectiveHp,
          `${hero.name}'s ${move.name} deals ${Math.round(damage)} to ${enemy.name} (${effectiveHp} HP) — a one-shot ends the fight before round 2`
        );
      }
    }
  }
});

test('tutorial: the opener cues are gated on a floor, not an exact round', () => {
  // An exact `round` on a fight whose length is being tuned is a cue that silently stops firing.
  // Anything that must be SEEN uses minRound; a conditional cue (Rest) is exempt.
  for (const cue of TUTORIAL_FIGHT_CUES) {
    if (!cueNodes(cue).includes('fight')) continue;
    if (cue.when.round === undefined) continue;
    assert.strictEqual(cue.when.round, 1, `${cue.id} is pinned to round ${cue.when.round}; use minRound so a shorter fight cannot skip it`);
  }
});

test('tutorial: a cue may span several fights, and every node it names is on the map', () => {
  const rest = TUTORIAL_FIGHT_CUES.find((cue) => cue.id === 'fight:rest')!;
  assert.ok(cueNodes(rest).length > 1, 'Rest depends on the player spending, not on a round — it cannot be promised to one fight');

  const ctx: TutorialFightContext = { ...quietFight, round: 4, anyOutOfMana: true };
  const seen = new Set(TUTORIAL_FIGHT_CUES.filter((c) => c.id !== rest.id).map((c) => c.id));
  for (const node of cueNodes(rest)) {
    assert.strictEqual(matchTutorialCue(TUTORIAL_FIGHT_CUES, node, ctx, seen), rest, `the Rest cue should be reachable at the ${node} node`);
  }
  // Still one-shot across the whole span, not once per fight.
  assert.strictEqual(matchTutorialCue(TUTORIAL_FIGHT_CUES, 'boss', ctx, new Set([...seen, rest.id])), null);
});

// --- Inline icons ---

test('tutorial: every bracketed token in the script names a real icon', () => {
  // An unknown token renders as literal prose — visible, but only if someone happens to replay
  // that beat. Cheaper to fail here.
  const lines = [
    ...TUTORIAL_SCRIPT.flatMap((beat) => beat.lines),
    ...TUTORIAL_FIGHT_CUES.flatMap((cue) => cue.lines),
  ].map((line) => normalizeLine(line).text);

  for (const text of lines) {
    const unknown = unknownIconTokens(text);
    assert.deepStrictEqual(
      unknown,
      [],
      `"${text.slice(0, 60)}…" uses ${unknown.map((t) => `[${t}]`).join(', ')} — not an icon token (${TUTORIAL_ICON_TOKENS.join(', ')})`
    );
  }
});

test('tutorial: a line splits into the text and icons it names, in order', () => {
  assert.deepStrictEqual(parseTutorialText('a [physical] b [magical]'), [
    { text: 'a ' },
    { icon: 'physical' },
    { text: ' b ' },
    { icon: 'magical' },
  ]);
  // Untokenised prose is one run, and an unknown token stays inside it rather than disappearing.
  assert.deepStrictEqual(parseTutorialText('plain text'), [{ text: 'plain text' }]);
  assert.deepStrictEqual(parseTutorialText('a [nonsense] b'), [{ text: 'a [nonsense] b' }]);
});

test('tutorial: the pipelines cue shows both marks, since showing them is the point', () => {
  const cue = TUTORIAL_FIGHT_CUES.find((c) => c.id === 'skirmish:pipelines')!;
  const icons = cue.lines
    .flatMap((line) => parseTutorialText(normalizeLine(line).text))
    .flatMap((segment) => ('icon' in segment ? [segment.icon] : []));
  assert.deepStrictEqual(icons, ['physical', 'magical'], 'the cue that names the two pipelines must print both badges');
});
