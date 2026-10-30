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
import { absorbItem } from '../src/run/runProgress';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { resolveBattleStartEntries } from '../src/engine/combat/passiveEngine';
import { fightWinner, getMaxMana, type CombatState } from '../src/engine/state';
import type { CombatEvent } from '../src/engine/events';
import type { Action } from '../src/engine/combat/actions';
import { guidedAction, scriptedEnemyActions, storySides, withStoryEnds, STORY_ENEMY_SIDE, STORY_PLAYER_SIDE, type StoryBeat, type StoryFight } from '../src/run/story';
import { LESSONS } from '../src/data/lessons';
import { sky } from '../src/data/sky';

const config = { heroes: allCombatants, moves, typeChart, statuses, passives, fieldEffects, benchHpRegenFlat: 10 };

type FightBeat = Extract<StoryBeat, { kind: 'fight' }>;
/** Every lesson's beats, in play order; a lesson is one fight but Equipment, which is two. */
const beats: FightBeat[] = LESSONS.chapters.flatMap((c) => {
  assert.strictEqual(c.beats.length, c.id === 'firstLight.gear' ? 2 : 1, `${c.id} has the wrong number of fights`);
  return c.beats;
});
/** A lesson's last beat: the one it is won on. */
const beatOf = (chapterId: string): FightBeat => {
  const chapter = LESSONS.chapters.find((c) => c.id === chapterId)!;
  return chapter.beats[chapter.beats.length - 1];
};
const fightOf = (chapterId: string): StoryFight => beatOf(chapterId).fight;

/** The board a lesson opens on, its hand-over seated as the item screen seats it unless `bare`. */
function open(fight: StoryFight, bare = false): CombatState {
  const sides = storySides(fight, allCombatants);
  const handOver = beats.find((b) => b.fight === fight)?.handOver;
  const roster = handOver && !bare ? absorbItem(sides.player.run, handOver.to, handOver.itemId, equipment, allCombatants).roster : sides.player.run.roster;
  const built = buildCombatState(
    fight.seed,
    allCombatants,
    equipment,
    [
      { side: STORY_PLAYER_SIDE, squad: sides.player.squad, roster },
      { side: STORY_ENEMY_SIDE, squad: sides.ai.squad, roster: sides.ai.run.roster },
    ],
    passives
  );
  return resolveBattleStartEntries(withStoryEnds(built, fight), 1, allCombatants, statuses, passives, fieldEffects).state;
}

/** Plays the guide against the script, round by round: the events of each round, and the board after it. `instead` swaps a hero's guided action. */
function play(
  fight: StoryFight,
  instead: (round: number, combatantId: string) => Action | null = () => null,
  bare = false
): { rounds: CombatEvent[][]; boards: CombatState[] } {
  let state = open(fight, bare);
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

const guided = beats.filter((b) => b.fight.guide.length > 0);

test('lessons: every lesson is a scenario star of First Light, and every First Light star a lesson', () => {
  const stars = sky.constellations.firstLight.stars.map((star) => (star.light.kind === 'scenario' ? star.light.scenarioId : null));
  assert.deepStrictEqual(stars, LESSONS.chapters.map((c) => c.id));
  for (const id of stars) assert.strictEqual(sky.scenarios[id!]?.lesson, id, `${id} plays its own lesson`);
});

test('lessons: every lesson has its line, casts base heroes, and points on every guided round', () => {
  for (const beat of beats) {
    const id = beat.fight.id;
    assert.ok(beat.line, `${id} has no line`);
    for (const spec of beat.fight.player) assert.ok(heroes[spec.heroId] && !heroes[spec.heroId].unlock, `${id}: ${spec.heroId} is not a base hero`);
    for (let round = 1; round <= beat.fight.guide.length; round++) {
      assert.ok(beat.cues?.some((cue) => cue.round === round && cue.point), `${id} round ${round} is guided with no hand`);
    }
  }
});

test('lessons: no team fields two heroes of one type', () => {
  for (const beat of beats) {
    const types = beat.fight.player.map((spec) => heroes[spec.heroId].types[0]);
    assert.strictEqual(new Set(types).size, types.length, `${beat.fight.id} fields ${types.join(', ')}`);
  }
});

test('lessons: each guided fight ends inside its script, won, with nobody down', () => {
  for (const beat of guided) {
    const { boards } = play(beat.fight);
    const last = boards[boards.length - 1];
    assert.strictEqual(fightWinner(last), 'A', `${beat.fight.id} is not won inside its script`);
    const down = Object.values(last.combatants).filter((c) => c.side === 'A' && c.fainted);
    assert.deepStrictEqual(down.map((c) => c.combatantId), [], `${beat.fight.id} knocks out the party`);
  }
});

const foesDown = (board: CombatState) => Object.values(board.combatants).filter((c) => c.side === 'B' && c.fainted).length;

test('lessons: each hero drops the foe it is pointed at, both in the first round', () => {
  const { boards } = play(fightOf('firstLight.move'));
  assert.strictEqual(boards.length, 2, 'one round');
  assert.strictEqual(foesDown(boards[1]), 2);
});

test('lessons: one Arcane Blast empties Pixie, so it Rests, and the second Blast finishes the foe', () => {
  const fight = fightOf('firstLight.mana');
  const { rounds, boards } = play(fight);
  assert.strictEqual(boards.length, 4, 'three rounds');
  const before2 = boards[1].combatants['A:pixie'];
  assert.ok(before2.currentMana < moves.arcaneBlast.manaCost, `Pixie can still afford Arcane Blast in round 2 (Mana ${before2.currentMana})`);
  assert.strictEqual(foesDown(boards[1]), 0, 'one Blast is not enough');
  assert.ok(boards[1].combatants['B:peb'].currentHp > 20, 'and plainly not: the foe stands well up');
  const before3 = boards[2].combatants['A:pixie'];
  assert.strictEqual(before3.currentMana, getMaxMana(allCombatants[before3.heroId], before3), 'the Rest refills it');
  assert.strictEqual(foesDown(boards[3]), 1);
  const noise = rounds.flat().filter((e) => e.type === 'StatChanged' || (e.type === 'StatusApplied' && e.combatantId === 'A:pixie'));
  assert.deepStrictEqual(noise, [], 'no stat moves and nothing lands on Pixie: the lesson is Mana alone');
});

test('lessons: each type finds the foe it hits hardest, and the other way round leaves both standing', () => {
  const fight = fightOf('firstLight.types');
  assert.strictEqual(foesDown(play(fight).boards[1]), 2, 'Fire on Nature and Storm on Water drop both');
  const swapped = play(fight, (_, id) => {
    const target = id === 'A:crimson' ? 'B:pud' : 'B:sprout';
    return { kind: 'move', combatantId: id, moveId: id === 'A:crimson' ? 'ember' : 'thunderclap', declaredTarget: target };
  });
  assert.strictEqual(foesDown(swapped.boards[1]), 0, 'Fire on Water and Storm on Nature drop neither');
});

test('lessons: one spread move drops both foes', () => {
  const { boards } = play(fightOf('firstLight.spread'));
  assert.strictEqual(boards.length, 2, 'one round');
  assert.strictEqual(foesDown(boards[1]), 2);
});

test('lessons: physical Nightfall through thin hide and magical Nightfall past low Wisdom drop both; crossed, neither falls', () => {
  const fight = fightOf('firstLight.kinds');
  const { rounds, boards } = play(fight);
  assert.strictEqual(foesDown(boards[1]), 2);
  assert.ok(!rounds.flat().some((e) => e.type === 'StatusApplied' && e.statusId === 'Shield'), 'no Shield stands between the hit and the lesson');
  const crossed = play(fight, (_, id) => ({ kind: 'move', combatantId: id, moveId: id === 'A:nightshade' ? 'nightfall' : 'nightfallRewired', declaredTarget: id === 'A:nightshade' ? 'B:ingot' : 'B:rillfin' }));
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

test('lessons: a lesson with a bench fields two leads or none, or the game asks to fill the empty slot first', () => {
  for (const chapter of LESSONS.chapters) {
    const beat = chapter.beats[0];
    if (beat.kind !== 'fight') continue;
    const benched = beat.fight.player.length > beat.fight.playerLeads.length;
    assert.ok(!benched || beat.fight.playerLeads.length !== 1, `${chapter.id} has a bench and one lead`);
  }
});

test('lessons: bare, Ursa\'s Claw takes two hits; given the Feral Dagger, one', () => {
  const [bare, armed] = LESSONS.chapters.find((c) => c.id === 'firstLight.gear')!.beats;
  assert.ok(!bare.handOver && armed.handOver, 'the piece arrives between the two fights');
  assert.ok(armed.fight.player.some((spec) => spec.rosterId === armed.handOver!.to), 'the piece goes to a hero in the party');
  const first = play(bare.fight);
  assert.strictEqual(first.boards[1].combatants['B:cub'].fainted, false, 'bare, one Claw leaves it standing');
  assert.strictEqual(first.boards[2].combatants['B:cub'].fainted, true, 'bare, the second Claw drops it');
  assert.strictEqual(play(armed.fight).boards[1].combatants['B:cub'].fainted, true, 'armed, one Claw drops it');
  const bled = [...first.rounds, ...play(armed.fight).rounds].flat().some((e) => e.type === 'StatusApplied' && e.statusId === 'Bleed');
  assert.ok(!bled, 'no Bleed chips in: the Claw alone is the difference');
});

test('lessons: the last lesson is the first open fight, a party of four holding only moves the lessons taught', () => {
  const last = beats[beats.length - 1].fight;
  assert.strictEqual(last.player.length, 4);
  assert.deepStrictEqual([last.playerLeads, last.guide, last.enemyScript], [[], [], []], 'nothing picked, guided or scripted for the player');
  assert.ok(last.enemy.length > 2, 'a foe waits on the bench');
  const taught = new Set(beats.slice(0, -1).flatMap((b) => b.fight.player.flatMap((spec) => spec.moveIds ?? [])));
  for (const spec of last.player) for (const id of spec.moveIds ?? []) assert.ok(taught.has(id), `${spec.heroId} holds ${id}, which no lesson used`);
  for (const spec of last.enemy) {
    assert.ok(spec.moveIds && spec.moveIds.length > 0, `${spec.heroId} fights with its whole kit`);
    for (const id of spec.moveIds) {
      const move = moves[id];
      assert.ok(move.kind === 'damage' && !move.statusApplication && !move.statDeltas && !move.fieldEffectApplication, `${spec.heroId}'s ${id} is not a plain hit`);
    }
  }
  assert.ok(beats.slice(0, -1).every((b) => b.fight.guide.length > 0), 'every lesson before it is guided');
});
