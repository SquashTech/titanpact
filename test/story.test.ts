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
import type { Action } from '../src/engine/combat/actions';
import type { PassiveDefinition } from '../src/engine/content';
import { createProfile, decodeProfile } from '../src/run/profile';
import { stateHash } from '../src/run/versus';
import {
  guidedAction,
  scriptedEnemyActions,
  storySides,
  withStoryEnds,
  STORY_ENEMY_SIDE,
  STORY_PLAYER_SIDE,
  storyNodeFight,
  type StoryFight,
} from '../src/run/story';
import { STORY_BOOKS } from '../src/data/lessons';
import { TIP_STAGING } from '../src/view/run/tipStaging';
import { TIP_SCENES } from '../src/data/tipScenes';

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

test('story: every catalog fight scripts only moves its actors hold, and leads and targets are in the parties', () => {
  for (const story of STORY_BOOKS) {
    for (const chapter of story.chapters) {
      const fights = chapter.beats.flatMap((beat) =>
        beat.kind === 'fight' ? [beat.fight] : beat.act.rows.flat().flatMap((node, i) => storyNodeFight(beat.act, node, `${chapter.id}#${i}`) ?? [])
      );
      for (const fight of fights) {
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

test('story tips: every control tip is short, unique, and lights something', () => {
  const seen = new Set<string>();
  for (const story of STORY_BOOKS) {
    for (const chapter of story.chapters) {
      for (const beat of chapter.beats) {
        const cues =
          beat.kind === 'fight' ? beat.cues ?? [] : beat.kind === 'act' ? beat.act.rows.flatMap((row) => row.flatMap((node) => node.cues ?? [])) : [];
        for (const tip of cues.flatMap((cue) => cue.tips ?? [])) {
          assert.ok(!seen.has(tip.id), `${tip.id} is used twice`);
          seen.add(tip.id);
          assert.ok(tip.pages.length >= 1 && tip.pages.length <= 3, `${tip.id} runs past three pages`);
          assert.ok(TIP_STAGING[tip.id] || TIP_SCENES[tip.id], `${tip.id} neither lights nor draws anything`);
        }
      }
    }
  }
});

