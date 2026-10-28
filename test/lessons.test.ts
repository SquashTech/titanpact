import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { equipment } from '../src/data/equipment';
import { allCombatants } from '../src/data/content';
import { heroes } from '../src/data/heroes';
import { buildCombatState } from '../src/run/buildCombatState';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { resolveBattleStartEntries } from '../src/engine/combat/passiveEngine';
import { fightWinner, getMaxMana, type CombatState } from '../src/engine/state';
import type { CombatEvent } from '../src/engine/events';
import type { Action } from '../src/engine/combat/actions';
import { guidedAction, scriptedEnemyActions, storyNodeFight, storySides, withStoryEnds, STORY_ENEMY_SIDE, STORY_PLAYER_SIDE, type StoryFight } from '../src/run/story';
import { LESSONS } from '../src/data/lessons';
import { sky } from '../src/data/sky';
import { STORY_CAST_IDS } from '../src/data/storyCast';

const config = { heroes: allCombatants, moves, typeChart, statuses, passives, fieldEffects, benchHpRegenFlat: 10 };

function open(fight: StoryFight): CombatState {
  const sides = storySides(fight, allCombatants);
  const built = buildCombatState(
    fight.seed,
    allCombatants,
    equipment,
    [
      { side: STORY_PLAYER_SIDE, squad: sides.player.squad, roster: sides.player.run.roster },
      { side: STORY_ENEMY_SIDE, squad: sides.ai.squad, roster: sides.ai.run.roster },
    ],
    passives
  );
  return resolveBattleStartEntries(withStoryEnds(built, fight), 1, allCombatants, statuses, passives, fieldEffects).state;
}

/** Plays the guide against the script, round by round: the events of each round, and the board after it. `instead` swaps a hero's guided action. */
function play(fight: StoryFight, instead: (round: number, combatantId: string) => Action | null = () => null): { rounds: CombatEvent[][]; boards: CombatState[] } {
  let state = open(fight);
  const rounds: CombatEvent[][] = [];
  const boards: CombatState[] = [state];
  while (state.round <= fight.guide.length && fightWinner(state) === null) {
    const player = state.active[STORY_PLAYER_SIDE].flatMap((id) => (id ? [instead(state.round, id) ?? guidedAction(fight, state, id)!] : []));
    const result = resolveRound(state, [...player, ...scriptedEnemyActions(fight, state)!], config);
    rounds.push(result.events);
    state = result.state;
    boards.push(state);
  }
  return { rounds, boards };
}

/** A guided fight: a fight beat's own, or the scripted tile of a one-tile act (the Hunt, played off the map). */
const fightOf = (chapterId: string): StoryFight => {
  const beat = LESSONS.chapters.find((c) => c.id === chapterId)?.beats[0];
  if (beat?.kind === 'fight') return beat.fight;
  const node = beat?.kind === 'act' ? beat.act.rows.flat().find((n) => n.script) : undefined;
  const fight = beat?.kind === 'act' && node ? storyNodeFight(beat.act, node, chapterId) : null;
  assert.ok(fight, `${chapterId} has no guided fight`);
  return fight;
};

test('lessons: every lesson is a scenario star of First Light, and every First Light star a lesson', () => {
  const stars = sky.constellations.firstLight.stars.map((star) => (star.light.kind === 'scenario' ? star.light.scenarioId : null));
  assert.deepStrictEqual(stars, LESSONS.chapters.map((c) => c.id));
  for (const id of stars) assert.strictEqual(sky.scenarios[id!]?.lesson, id, `${id} plays its own lesson`);
});

test('lessons: every cue teaches, and the party is the base roster bar the lesson Valor', () => {
  for (const chapter of LESSONS.chapters) {
    for (const beat of chapter.beats) {
      assert.ok(beat.kind === 'fight' || beat.kind === 'act', `${chapter.id} holds a ${beat.kind}`);
      const cues = beat.kind === 'fight' ? beat.cues ?? [] : beat.act.rows.flat().flatMap((node) => node.cues ?? []);
      for (const cue of cues) assert.ok(cue.tips?.length || cue.point, `${chapter.id} round ${cue.round} teaches nothing`);
      const party = beat.kind === 'fight' ? beat.fight.player : beat.act.party;
      for (const spec of party) {
        const ok = spec.heroId === STORY_CAST_IDS.valor || (heroes[spec.heroId] && !heroes[spec.heroId].unlock);
        assert.ok(ok, `${chapter.id}: ${spec.heroId} is not a base hero`);
      }
    }
  }
});

test('lessons: a lesson with a line points on every guided round; an older one has a hero on the field call it', () => {
  for (const chapter of LESSONS.chapters) {
    const beat = chapter.beats[0];
    if (beat.kind === 'fight' && beat.line) {
      for (let round = 1; round <= beat.fight.guide.length; round++) assert.ok(beat.cues?.some((cue) => cue.round === round && cue.point), `${chapter.id} round ${round} is guided with no hand`);
      continue;
    }
    const cues = beat.kind === 'fight' ? beat.cues ?? [] : beat.kind === 'act' ? beat.act.rows.flat().find((n) => n.script)?.cues ?? [] : [];
    if (beat.kind === 'act' && !beat.act.rows.flat().some((n) => n.script)) continue;
    const fight = fightOf(chapter.id);
    const { boards } = play(fight);
    for (let round = 1; round <= fight.guide.length; round++) {
      const lines = cues.find((cue) => cue.round === round)?.lines;
      assert.ok(lines?.length, `${chapter.id} round ${round} is guided with no hero calling it`);
      for (const line of lines) {
        assert.ok(boards[round - 1].active.A.includes(`A:${line.by}`), `${chapter.id} round ${round}: ${line.by} speaks from off the field`);
      }
    }
  }
});

test('lessons: each guided fight ends inside its script, won, with nobody down', () => {
  for (const id of LESSONS.chapters.filter((c) => c.beats[0].kind === 'fight').map((c) => c.id)) {
    const fight = fightOf(id);
    const { boards } = play(fight);
    const last = boards[boards.length - 1];
    assert.strictEqual(fightWinner(last), 'A', `${id} is not won inside its script`);
    const down = Object.values(last.combatants).filter((c) => c.side === 'A' && c.fainted);
    assert.deepStrictEqual(down.map((c) => c.combatantId), [], `${id} knocks out the party`);
  }
});

const foesDown = (board: CombatState) => Object.values(board.combatants).filter((c) => c.side === 'B' && c.fainted).length;

test('lessons: each hero drops the foe it is pointed at, both in the first round', () => {
  const { boards } = play(fightOf('firstLight.move'));
  assert.strictEqual(boards.length, 2, 'one round');
  assert.strictEqual(foesDown(boards[1]), 2);
});

test('lessons: one Torrent empties Riptide, so it Rests, and the second Torrent finishes the foe', () => {
  const fight = fightOf('firstLight.mana');
  const { boards } = play(fight);
  assert.strictEqual(boards.length, 4, 'three rounds');
  const before2 = boards[1].combatants['A:riptide'];
  assert.ok(before2.currentMana < moves.torrent.manaCost, `Riptide can still afford Torrent in round 2 (Mana ${before2.currentMana})`);
  assert.strictEqual(foesDown(boards[1]), 0, 'one Torrent is not enough');
  const before3 = boards[2].combatants['A:riptide'];
  assert.strictEqual(before3.currentMana, getMaxMana(allCombatants[before3.heroId], before3), 'the Rest refills it');
  assert.strictEqual(foesDown(boards[3]), 1);
});

test('lessons: each type finds the foe it hits hardest, and the other way round leaves both standing', () => {
  const fight = fightOf('firstLight.types');
  assert.strictEqual(foesDown(play(fight).boards[1]), 2, 'Fire on Nature and Storm on Water drop both');
  const swapped = play(fight, (_, id) => {
    const target = id === 'A:cinder' ? 'B:pud' : 'B:sprout';
    return { kind: 'move', combatantId: id, moveId: id === 'A:cinder' ? 'singe' : 'thunderclap', declaredTarget: target };
  });
  assert.strictEqual(foesDown(swapped.boards[1]), 0, 'Fire on Water and Storm on Nature drop neither');
});

test('lessons: one spread move drops both foes', () => {
  const { boards } = play(fightOf('firstLight.spread'));
  assert.strictEqual(boards.length, 2, 'one round');
  assert.strictEqual(foesDown(boards[1]), 2);
});

const acted = (events: readonly CombatEvent[], id: string) => events.some((e) => e.type === 'MoveUsed' && e.combatantId === id);

test('lessons: Skyshear outruns the Cubling and drops it before it swings; aimed the other way, the Cubling hits Ursa first', () => {
  const fight = fightOf('firstLight.order');
  const { rounds, boards } = play(fight);
  assert.ok(!acted(rounds[0], 'B:cub'), 'the Cubling never moves');
  assert.strictEqual(foesDown(boards[1]), 2);
  const swapped = play(fight, (_, id) => ({ kind: 'move', combatantId: id, moveId: id === 'A:skyshear' ? 'jolt' : 'claw', declaredTarget: id === 'A:skyshear' ? 'B:arc' : 'B:cub' }));
  assert.ok(acted(swapped.rounds[0], 'B:cub'), 'Ursa is too slow to stop it');
});

test('lessons: physical Nightfall through thin hide and magical Nightfall past low Wisdom drop both; crossed, neither falls', () => {
  const fight = fightOf('firstLight.kinds');
  assert.strictEqual(foesDown(play(fight).boards[1]), 2);
  const crossed = play(fight, (_, id) => ({ kind: 'move', combatantId: id, moveId: id === 'A:nightshade' ? 'nightfall' : 'nightfallRewired', declaredTarget: id === 'A:nightshade' ? 'B:pincer' : 'B:pixie' }));
  assert.strictEqual(foesDown(crossed.boards[1]), 0);
});

test('lessons: Singe leaves the burning Rivetling standing, and the Burn at the round end puts it down', () => {
  const { rounds, boards } = play(fightOf('firstLight.burn'));
  assert.strictEqual(rounds.length, 2);
  const last = rounds[1];
  const hit = last.findIndex((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'B:rivet');
  const tick = last.findIndex((e) => e.type === 'StatusTicked' && e.combatantId === 'B:rivet');
  const fell = last.findIndex((e) => e.type === 'Fainted' && e.combatantId === 'B:rivet');
  assert.ok(hit >= 0 && tick > hit && fell > tick, 'the Burn, not the Singe, lands the knockout');
  assert.strictEqual(foesDown(boards[2]), 1);
});

test('lessons: switching to Raiju takes the splash lightly, where Cinder would have taken it hard', () => {
  const fight = fightOf('firstLight.switch');
  const { boards } = play(fight);
  const lost = (b: CombatState[], id: string) => b[0].combatants[id].currentHp - b[1].combatants[id].currentHp;
  assert.strictEqual(foesDown(boards[2]), 2, 'Thunderclap and Claw finish the Puddling');
  const stayed = play(fight, (_, id) => (id === 'A:cinder' ? { kind: 'move', combatantId: id, moveId: 'singe', declaredTarget: 'B:pud' } : null));
  assert.ok(lost(boards, 'A:raiju') * 2 < lost(stayed.boards, 'A:cinder'), `Raiju lost ${lost(boards, 'A:raiju')}, Cinder would lose ${lost(stayed.boards, 'A:cinder')}`);
});

test('lessons: a lesson with a bench fields two leads, or the game asks to fill the empty slot first', () => {
  for (const chapter of LESSONS.chapters) {
    const beat = chapter.beats[0];
    if (beat.kind !== 'fight') continue;
    const benched = beat.fight.player.length > beat.fight.playerLeads.length;
    assert.ok(!benched || beat.fight.playerLeads.length === 2, `${chapter.id} has a bench and one lead`);
  }
});
