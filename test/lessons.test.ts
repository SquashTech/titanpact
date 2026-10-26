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

/** Plays the guide against the script, round by round: the events of each round, and the board after it. */
function play(fight: StoryFight): { rounds: CombatEvent[][]; boards: CombatState[] } {
  let state = open(fight);
  const rounds: CombatEvent[][] = [];
  const boards: CombatState[] = [state];
  while (state.round <= fight.guide.length && fightWinner(state) === null) {
    const player = state.active[STORY_PLAYER_SIDE].flatMap((id) => (id ? [guidedAction(fight, state, id)!] : []));
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

test('lessons: a hero on the field calls the plan on every guided round', () => {
  for (const chapter of LESSONS.chapters) {
    const beat = chapter.beats[0];
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
  for (const id of ['firstLight.hunt', 'firstLight.clearing']) {
    const fight = fightOf(id);
    const { boards } = play(fight);
    const last = boards[boards.length - 1];
    assert.strictEqual(fightWinner(last), 'A', `${id} is not won inside its script`);
    const down = Object.values(last.combatants).filter((c) => c.side === 'A' && c.fainted);
    assert.deepStrictEqual(down.map((c) => c.combatantId), [], `${id} knocks out the party`);
  }
});

test('lessons: in the clearing, the Warden runs dry and Rests under a Shield, then the Raiju marks the Slabback for the Warden to set off', () => {
  const fight = fightOf('firstLight.clearing');
  const { rounds, boards } = play(fight);
  assert.strictEqual(rounds.length, 5, 'the spawn stand into round 5');
  const before4 = boards[3].combatants['A:warden'];
  const kit = fight.player.find((spec) => spec.rosterId === 'warden')!.moveIds!;
  const affordable = kit.filter((moveId) => moves[moveId].manaCost <= before4.currentMana);
  assert.deepStrictEqual(affordable, [], `the Warden can still afford ${affordable.join(', ')} (Mana ${before4.currentMana}/${getMaxMana(allCombatants[before4.heroId], before4)})`);
  const soaked = rounds[3].find((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'A:warden');
  assert.ok(soaked && soaked.type === 'DamageDealt' && (soaked.absorbed ?? 0) > 0, "Rime Coat's Shield takes a hit on the Resting Warden");
  const planted = rounds[4].find((e) => e.type === 'StatusApplied' && e.statusId === 'Conduct');
  assert.ok(planted && planted.type === 'StatusApplied' && planted.sourceCombatantId === 'A:raiju', 'Storm Lash plants Conduct');
  assert.ok(rounds[4].some((e) => e.type === 'StatusDetonated' && e.statusId === 'Conduct'), "the Warden's Gale Sever sets it off in the same round");
  const foes = Object.values(boards[boards.length - 1].combatants).filter((c) => c.side === 'B');
  assert.ok(foes.every((c) => c.fainted), 'both spawn fall in round 5');
});
