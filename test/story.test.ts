import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { equipment } from '../src/data/equipment';
import { allCombatants } from '../src/data/content';
import { buildCombatState } from '../src/run/buildCombatState';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { resolveBattleStartEntries } from '../src/engine/combat/passiveEngine';
import { applyHpDelta } from '../src/engine/combat/faintHandling';
import { fightWinner, type CombatState } from '../src/engine/state';
import type { CombatEvent } from '../src/engine/events';
import type { PassiveDefinition } from '../src/engine/content';
import { createProfile, decodeProfile, recordStoryChapterDone } from '../src/run/profile';
import { stateHash } from '../src/run/versus';
import {
  guidedAction,
  scriptedEnemyActions,
  storySides,
  withStoryEnds,
  STORY_ENEMY_SIDE,
  STORY_PLAYER_SIDE,
  endsStoryAct,
  storyActMap,
  storyActRun,
  storyNodeEncounter,
  type StoryAct,
  type StoryActNode,
  type StoryFight,
} from '../src/run/story';
import { storyCatalog } from '../src/data/stories';
import { rosterHeroes } from '../src/data/content';
import { MAP_NODE_TYPES } from '../src/run/map';
import { levelOf } from '../src/run/growth';
import { patrons } from '../src/data/patrons';
import { patronAtSeat, seatIndexFor, studentOf } from '../src/run/patrons';
import { PATRON_ROWS } from '../src/run/map';
import { withReachableSeatOffers } from '../src/run/runProgress';

const UNBREAKABLE = 'storyTestUnbreakable';
const testPassives: Record<string, PassiveDefinition> = {
  ...passives,
  [UNBREAKABLE]: { id: UNBREAKABLE, name: 'Undying', description: 'Can’t be knocked out.', cannotBeKnockedOut: true },
};
const config = { heroes: allCombatants, moves, typeChart, statuses, passives: testPassives, fieldEffects, benchHpRegenFlat: 10 };

const foe = { side: STORY_ENEMY_SIDE, rosterId: 'wisp' } as const;
const valorTarget = { side: STORY_PLAYER_SIDE, rosterId: 'valor' } as const;

const FIGHT: StoryFight = {
  id: 'test',
  seed: 4242,
  player: [
    { rosterId: 'valor', heroId: 'valor', level: 2 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 2 },
  ],
  playerLeads: ['valor', 'fang'],
  enemy: [
    { rosterId: 'wisp', heroId: 'drift', level: 1, passiveIds: [UNBREAKABLE] },
    { rosterId: 'wisp2', heroId: 'drift', level: 1 },
  ],
  enemyLeads: ['wisp', 'wisp2'],
  enemyScript: [
    [{ actor: 'wisp', moveId: 'psiBolt', target: valorTarget }, { actor: 'wisp2', rest: true }],
    [{ actor: 'wisp', moveId: 'psiBolt', target: valorTarget }, { actor: 'wisp2', rest: true }],
  ],
  guide: [
    [{ actor: 'valor', moveId: 'ironFist', target: foe }, { actor: 'fang', moveId: 'claw', target: foe }],
    [{ actor: 'valor', moveId: 'ironFist', target: foe }, { actor: 'fang', moveId: 'claw', target: foe }],
  ],
  endsWhen: [{ kind: 'afterRound', round: 6, winner: STORY_PLAYER_SIDE }],
};

function openStoryFight(fight: StoryFight): CombatState {
  const sides = storySides(fight, allCombatants);
  const built = buildCombatState(
    fight.seed,
    allCombatants,
    equipment,
    [
      { side: STORY_PLAYER_SIDE, squad: sides.player.squad, roster: sides.player.run.roster },
      { side: STORY_ENEMY_SIDE, squad: sides.ai.squad, roster: sides.ai.run.roster },
    ],
    testPassives
  );
  return resolveBattleStartEntries(withStoryEnds(built, fight), 1, allCombatants, statuses, testPassives, fieldEffects).state;
}

/** Plays every scripted round, both sides off the script, and returns the event stream and the board after each. */
function playScript(fight: StoryFight): { events: CombatEvent[]; hashes: number[]; state: CombatState } {
  let state = openStoryFight(fight);
  const events: CombatEvent[] = [];
  const hashes: number[] = [];
  while (state.round <= fight.guide.length && fightWinner(state) === null) {
    const player = state.active[STORY_PLAYER_SIDE].flatMap((id) => (id ? [guidedAction(fight, state, id)!] : []));
    const result = resolveRound(state, [...player, ...scriptedEnemyActions(fight, state)!], config);
    state = result.state;
    events.push(...result.events);
    hashes.push(stateHash(state));
  }
  return { events, hashes, state };
}

test('story: a scripted fight replays to the identical event stream and board', () => {
  const first = playScript(FIGHT);
  const second = playScript(FIGHT);
  assert.ok(first.events.some((e) => e.type === 'DamageDealt'), 'the script lands hits');
  assert.deepStrictEqual(second.events, first.events);
  assert.deepStrictEqual(second.hashes, first.hashes);
});

test('story: the party fields at its authored levels, kits and leads', () => {
  const state = openStoryFight(FIGHT);
  assert.deepStrictEqual(state.active.A, ['A:valor', 'A:fang']);
  assert.deepStrictEqual(state.active.B, ['B:wisp', 'B:wisp2']);
  const sides = storySides(FIGHT, allCombatants);
  assert.deepStrictEqual(sides.player.run.roster.find((r) => r.rosterId === 'valor')!.unlockedMoveIds, allCombatants.valor.moveIds);
  assert.strictEqual(state.combatants['B:wisp'].unbreakable, true);
  assert.strictEqual(state.combatants['B:wisp2'].unbreakable, undefined);
});

test('story: guidance covers the scripted rounds and leaves the rest to the player', () => {
  const state = openStoryFight(FIGHT);
  assert.deepStrictEqual(guidedAction(FIGHT, state, 'A:valor'), { kind: 'move', combatantId: 'A:valor', moveId: 'ironFist', declaredTarget: 'B:wisp' });
  const later = { ...state, round: FIGHT.guide.length + 1 };
  assert.strictEqual(guidedAction(FIGHT, later, 'A:valor'), null);
  assert.strictEqual(scriptedEnemyActions(FIGHT, later), null);
});

test('story: a scripted command from a fallen or benched actor is dropped', () => {
  const state = openStoryFight(FIGHT);
  const downed: CombatState = { ...state, combatants: { ...state.combatants, 'B:wisp2': { ...state.combatants['B:wisp2'], fainted: true } } };
  assert.deepStrictEqual(scriptedEnemyActions(FIGHT, downed)!.map((a) => a.combatantId), ['B:wisp']);
});

test('story: an unbreakable holder refuses every knockout at 1 HP, without limit', () => {
  let state = openStoryFight(FIGHT);
  for (let i = 0; i < 3; i++) {
    const hit = applyHpDelta(state, 1, 'B:wisp', -9999, 9999);
    state = hit.state;
    assert.strictEqual(state.combatants['B:wisp'].currentHp, 1);
    assert.strictEqual(state.combatants['B:wisp'].fainted, false);
    assert.ok(hit.events.some((e) => e.type === 'Endured'));
  }
  const plain = applyHpDelta(state, 1, 'B:wisp2', -9999, 9999);
  assert.strictEqual(plain.state.combatants['B:wisp2'].fainted, true);
});

test('story: a fight ends on its trigger, and a wiped side still ends it first', () => {
  const state = openStoryFight(FIGHT);
  assert.strictEqual(fightWinner(state), null);
  assert.strictEqual(fightWinner({ ...state, round: 7 }), 'A');
  const held: CombatState = { ...state, endsWhen: [{ kind: 'hpAtMost', combatantId: 'B:wisp', hp: 1, winner: 'A' }] };
  assert.strictEqual(fightWinner(held), null);
  assert.strictEqual(fightWinner(applyHpDelta(held, 1, 'B:wisp', -9999, 9999).state), 'A');
  const wiped: CombatState = {
    ...state,
    combatants: Object.fromEntries(Object.entries(state.combatants).map(([id, c]) => [id, c.side === 'A' ? { ...c, fainted: true } : c])),
  };
  assert.strictEqual(fightWinner({ ...wiped, round: 7 }), 'B');
});

test('story: a finished chapter is recorded once and survives a reload', () => {
  const done = recordStoryChapterDone(recordStoryChapterDone(createProfile(), 'valor-1'), 'valor-1');
  assert.deepStrictEqual(done.storyChaptersDone, ['valor-1']);
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(done))).storyChaptersDone, ['valor-1']);
  assert.deepStrictEqual(decodeProfile({ version: 2 }).storyChaptersDone, []);
});

test('story: every catalog fight scripts only moves its actors hold, and leads and targets are in the parties', () => {
  for (const story of storyCatalog) {
    for (const chapter of story.chapters) {
      for (const beat of chapter.beats) {
        if (beat.kind !== 'fight') continue;
        const { fight } = beat;
        const sides = storySides(fight, allCombatants);
        const kit = (side: 'A' | 'B', rosterId: string) =>
          (side === 'A' ? sides.player : sides.ai).run.roster.find((r) => r.rosterId === rosterId)?.unlockedMoveIds;
        const check = (side: 'A' | 'B', script: StoryFight['guide']) => {
          for (const round of script) {
            for (const command of round) {
              assert.ok(kit(side, command.actor), `${fight.id}: ${command.actor} is not in the party`);
              if ('moveId' in command) {
                assert.ok(kit(side, command.actor)!.includes(command.moveId), `${fight.id}: ${command.actor} does not hold ${command.moveId}`);
                if (command.target) assert.ok(kit(command.target.side, command.target.rosterId), `${fight.id}: target ${command.target.rosterId} is not in the fight`);
              }
              if ('switchTo' in command) assert.ok(kit(side, command.switchTo), `${fight.id}: ${command.switchTo} is not in the party`);
            }
          }
        };
        check('A', fight.guide);
        check('B', fight.enemyScript);
      }
    }
  }
});

test('story: each prologue fight ends inside its script, won, with no hero of the party down', () => {
  for (const beat of storyCatalog[0].chapters[0].beats) {
    if (beat.kind !== 'fight') continue;
    const played = playScript(beat.fight);
    assert.strictEqual(fightWinner(played.state), 'A', `${beat.fight.id} is not won inside its script`);
    const down = Object.values(played.state.combatants).filter((c) => c.side === 'A' && c.fainted);
    assert.deepStrictEqual(down.map((c) => c.combatantId), [], `${beat.fight.id} knocks out the party`);
  }
  const clearing = storyCatalog[0].chapters[0].beats.find((b) => b.kind === 'fight' && b.fight.id === 'valor-1-clearing');
  assert.ok(clearing && clearing.kind === 'fight');
  const held = playScript(clearing.fight).state.combatants['B:faceless'];
  assert.strictEqual(held.currentHp, 1, 'the Faceless is brought to its knees, not outlasted');
  assert.strictEqual(held.fainted, false);
});

const actBeats = storyCatalog.flatMap((story) =>
  story.chapters.flatMap((chapter) => chapter.beats.map((beat, index) => ({ chapter, beat, index }))).filter((b) => b.beat.kind === 'act')
);

test('story act: the map is the authored rows, every row fully connected to the next, the last row its end', () => {
  for (const { beat } of actBeats) {
    if (beat.kind !== 'act') continue;
    const map = storyActMap(beat.act, 9);
    assert.strictEqual(map.rows.length, beat.act.rows.length);
    map.rows.forEach((row, r) => {
      assert.deepStrictEqual(row.map((id) => map.nodes[id].type), beat.act.rows[r].map((n) => n.type));
      for (const id of row) assert.deepStrictEqual(map.nodes[id].nextIds, r + 1 < map.rows.length ? map.rows[r + 1] : []);
    });
    assert.deepStrictEqual(map.startNodeIds, map.rows[0]);
    assert.strictEqual(map.bossNodeId, map.rows[map.rows.length - 1][0]);
    for (const id of Object.keys(map.nodes)) assert.ok((MAP_NODE_TYPES as readonly string[]).includes(map.nodes[id].type), `${id} is not a map node type`);
  }
});

test('story act: the run holds the party at its levels, no contract, no companion, and the marker back to its chapter', () => {
  const { chapter, beat, index } = actBeats[0];
  assert.ok(beat.kind === 'act');
  const run = storyActRun(beat.act, { chapterId: chapter.id, beat: index }, rosterHeroes, 3);
  assert.deepStrictEqual(run.story, { chapterId: chapter.id, beat: index });
  assert.strictEqual(run.recruitContracts, 0);
  assert.strictEqual(run.companion, null);
  assert.deepStrictEqual(run.locationIds, [beat.act.locationId]);
  assert.deepStrictEqual(
    run.roster.map((entry) => [entry.rosterId, levelOf(entry)]),
    beat.act.party.map((spec) => [spec.rosterId, spec.level])
  );
});

test('story act: a fight node fields its authored party, a reward node none, and only the last row ends the act', () => {
  for (const { chapter, beat, index } of actBeats) {
    if (beat.kind !== 'act') continue;
    const run = storyActRun(beat.act, { chapterId: chapter.id, beat: index }, rosterHeroes, 3);
    for (const node of Object.values(run.map!.nodes)) {
      const spec: StoryActNode = beat.act.rows[node.row][node.col];
      const encounter = storyNodeEncounter(run, storyCatalog, node.id, allCombatants);
      if (spec.enemy) assert.deepStrictEqual(encounter!.run.roster.map((e) => e.heroId), spec.enemy.map((e) => e.heroId), `${node.id}`);
      else assert.strictEqual(encounter, null, `${node.id} is a reward and fields nobody`);
      assert.strictEqual(endsStoryAct(run, node.id), node.row === beat.act.rows.length - 1);
    }
    const lastRow = beat.act.rows[beat.act.rows.length - 1];
    assert.ok(lastRow.length === 1 && lastRow[0].enemy, `${chapter.id}: an act ends on one fight`);
  }
  const classic = { ...storyActRun((actBeats[0].beat as { act: StoryAct }).act, { chapterId: 'x', beat: 0 }, rosterHeroes, 3), story: undefined };
  assert.strictEqual(storyNodeEncounter(classic, storyCatalog, 'r0-c0', allCombatants), null);
  assert.strictEqual(endsStoryAct(classic, classic.map!.bossNodeId), false);
});

test('story act: every fight names its drop and every Items chest its three, each a real piece that suits a party stat', () => {
  for (const { chapter, beat } of actBeats) {
    if (beat.kind !== 'act') continue;
    const swings = new Set<string>();
    for (const spec of beat.act.party) {
      const stats = rosterHeroes[spec.heroId].baseStats;
      swings.add(stats.attack >= stats.intelligence ? 'attack' : 'intelligence');
      for (const stat of ['defense', 'speed', 'hp'] as const) swings.add(stat);
    }
    for (const row of beat.act.rows) {
      for (const node of row) {
        const ids = node.enemy ? [node.drop] : node.type === 'equipmentReward' ? node.items ?? [] : [];
        if (node.enemy) assert.ok(node.drop, `${chapter.id}: a fight with no drop`);
        if (node.type === 'equipmentReward') assert.strictEqual(node.items?.length, 3, `${chapter.id}: a chest holds three`);
        for (const id of ids) {
          const item = equipment[id!];
          assert.ok(item, `${chapter.id}: ${id} is not an item`);
          const grants = Object.keys(item.statGrants ?? {});
          assert.ok(grants.some((stat) => swings.has(stat)), `${chapter.id}: ${id} suits nobody in the party`);
        }
      }
    }
  }
});

test('story act: a patron seat seats the patron it names, on a patron row, teaching a student in the party', () => {
  let seated = 0;
  for (const { chapter, beat, index } of actBeats) {
    if (beat.kind !== 'act') continue;
    const run = storyActRun(beat.act, { chapterId: chapter.id, beat: index }, rosterHeroes, 3);
    for (const [patronId, rosterId] of Object.entries(beat.act.students ?? {})) {
      assert.ok(patrons[patronId], `${chapter.id}: no patron ${patronId}`);
      assert.ok(run.roster.some((entry) => entry.rosterId === rosterId), `${chapter.id}: ${rosterId} is not in the party`);
      assert.strictEqual(studentOf(run, patronId), rosterId);
    }
    for (const node of Object.values(run.map!.nodes)) {
      if (node.type !== 'patronSeat') continue;
      const seat = seatIndexFor(run.actNumber, node.row, PATRON_ROWS);
      assert.notStrictEqual(seat, null, `${chapter.id}: a seat off the patron rows`);
      assert.strictEqual(patronAtSeat(run, seat!, node.col), beat.act.rows[node.row][node.col].patrons![0]);
      assert.deepStrictEqual(withReachableSeatOffers(run).patrons, run.patrons, 'the authored seat is never redrawn');
      seated++;
    }
  }
  assert.ok(seated > 0, 'some chapter seats a patron');
});
