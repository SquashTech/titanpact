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
import { absorbItem, itemReceiptFor } from '../src/run/runProgress';
import { GEM_ORDER, placeGem } from '../src/run/gems';
import { claimContract, deriveContractOffer } from '../src/run/recruitment';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { resolveBattleStartEntries } from '../src/engine/combat/passiveEngine';
import { fightWinner, getMaxMana, type CombatState } from '../src/engine/state';
import type { CombatEvent } from '../src/engine/events';
import type { Action } from '../src/engine/combat/actions';
import { guidedAction, scriptedEnemyActions, storyEntry, storyParty, storySides, withStoryEnds, STORY_ENEMY_SIDE, STORY_PLAYER_SIDE, type StoryBeat, type StoryChapter, type StoryFight, type StoryScreen } from '../src/run/story';
import { LESSONS } from '../src/data/lessons';
import { sky } from '../src/data/sky';

const config = { heroes: allCombatants, moves, typeChart, statuses, passives, fieldEffects, benchHpRegenFlat: 10 };

type FightBeat = Extract<StoryBeat, { kind: 'fight' }>;
type ScreenBeat = Extract<StoryBeat, { kind: 'screen' }>;
/** The lessons played on a run's own screens, with no fight. */
const SCREEN_LESSONS = ['firstLight.gear', 'firstLight.gems', 'firstLight.contracts'];
/** Every fight lesson's beat, in play order: a fight lesson is one fight. */
const beats: FightBeat[] = LESSONS.chapters.flatMap((c) => c.beats.filter((b): b is FightBeat => b.kind === 'fight'));
const fightOf = (chapterId: string): StoryFight => {
  const chapter = LESSONS.chapters.find((c) => c.id === chapterId)!;
  return (chapter.beats[0] as FightBeat).fight;
};
const chapterOf = (id: string): StoryChapter => LESSONS.chapters.find((c) => c.id === id)!;
const screensOf = (id: string): StoryScreen[] => chapterOf(id).beats.map((b) => (b as ScreenBeat).screen);

/** The board a lesson opens on. */
function open(fight: StoryFight): CombatState {
  const sides = storySides(fight, allCombatants);
  const roster = sides.player.run.roster;
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

const guided = beats.filter((b) => b.fight.guide.length > 0);

test('lessons: a fight lesson is one fight; a screen lesson has no fight and a party to act on', () => {
  for (const chapter of LESSONS.chapters) {
    if (SCREEN_LESSONS.includes(chapter.id)) {
      assert.ok(chapter.party && chapter.party.length > 0, `${chapter.id} has no party`);
      for (const beat of chapter.beats) assert.ok(beat.kind === 'screen' && beat.line, `${chapter.id} holds a fight or a beat with no line`);
      for (const spec of chapter.party) assert.ok(heroes[spec.heroId] && !heroes[spec.heroId].unlock, `${chapter.id}: ${spec.heroId} is not a base hero`);
    } else assert.deepStrictEqual(chapter.beats.map((b) => b.kind), ['fight'], chapter.id);
  }
});

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

test('lessons: Set Alight burns the Rivetling, and Immolate on the Burning foe triples and drops it; without the Burn, two Immolates do not', () => {
  const fight = fightOf('firstLight.burn');
  const { rounds, boards } = play(fight);
  assert.strictEqual(rounds.length, 2);
  assert.ok(rounds[0].some((e) => e.type === 'StatusTicked' && e.combatantId === 'B:rivet'), 'the Burn ticks at the first round end');
  assert.strictEqual(foesDown(boards[1]), 0);
  const hit = rounds[1].find((e) => e.type === 'DamageDealt' && e.moveId === 'immolate');
  assert.ok(hit && hit.type === 'DamageDealt' && hit.basePowerMultiplier === 3 && hit.finishing, 'Immolate, tripled, lands the knockout');
  const crits = rounds.flat().filter((e) => e.type === 'DamageDealt' && e.isCrit);
  assert.deepStrictEqual(crits, [], 'no critical hit steals the moment');
  const plain = play(fight, (_, id) => ({ kind: 'move', combatantId: id, moveId: 'immolate', declaredTarget: 'B:rivet' }));
  assert.strictEqual(foesDown(plain.boards[2]), 0, 'two Immolates on a foe that is not Burning leave it standing');
});

test('lessons: the first lesson shows no type arrow, and neither hit overkills its foe twice over', () => {
  const fight = fightOf('firstLight.move');
  const { rounds, boards } = play(fight);
  for (const e of rounds.flat()) if (e.type === 'DamageDealt') assert.strictEqual(e.typeMult, 1, `${e.moveId} on ${e.targetCombatantId} is not neutral`);
  for (const spec of fight.player) for (const id of spec.moveIds ?? []) for (const f of fight.enemy) {
    const mult = allCombatants[f.heroId].types.reduce((m, t) => m * (typeChart[moves[id].type]?.[t] ?? 1), 1);
    assert.strictEqual(mult, 1, `${id} on ${f.heroId} would show an arrow`);
  }
  for (const e of rounds[0]) {
    if (e.type !== 'DamageDealt' || !e.targetCombatantId.startsWith('B')) continue;
    const hp = boards[0].combatants[e.targetCombatantId].currentHp;
    const raw = (e.basePower * e.basePowerMultiplier + e.elementalForceBonus) * e.ratio * e.stab * e.typeMult * e.variance * e.critMultiplier;
    assert.ok(raw < 2 * hp, `${e.moveId} hits ${Math.round(raw)} on ${hp} HP`);
  }
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

test('lessons: Equipment gives Ursa the Feral Dagger, and a second Dagger merges into it a tier up', () => {
  const [take, merge] = screensOf('firstLight.gear');
  assert.ok(take.kind === 'item' && merge.kind === 'item');
  let run = storyParty(chapterOf('firstLight.gear').party!, allCombatants);
  const ursa = () => run.roster.find((r) => r.rosterId === 'ursa')!;
  assert.strictEqual(itemReceiptFor(ursa(), equipment[take.itemId], heroes.ursa, equipment).kind, 'take');
  run = absorbItem(run, take.to, take.itemId, equipment, allCombatants);
  const receipt = itemReceiptFor(ursa(), equipment[merge.itemId], heroes.ursa, equipment);
  assert.ok(receipt.kind === 'merge' && receipt.resultRarity === 'rare', 'the second piece merges, a Rare');
  run = absorbItem(run, merge.to, merge.itemId, equipment, allCombatants);
  assert.deepStrictEqual(ursa().equipment, [receipt.resultId], 'one piece, merged');
});

test('lessons: Gems go in the order the screen hands them out, each a stat and a Mastery pip on the hero it names', () => {
  const [screen] = screensOf('firstLight.gems');
  assert.ok(screen.kind === 'gems');
  const order = screen.gems.map((g) => GEM_ORDER.indexOf(g.gem.stat));
  assert.deepStrictEqual(order, [...order].sort((x, y) => x - y), 'in the fixed order');
  let run = storyParty(chapterOf('firstLight.gems').party!, allCombatants);
  for (const { gem, to } of screen.gems) {
    const before = run.roster.find((r) => r.rosterId === to)!.mastery;
    run = placeGem(run, to, gem);
    assert.strictEqual(run.roster.find((r) => r.rosterId === to)!.mastery, before + 1, `${to} takes a pip`);
  }
});

test('lessons: Contracts signs a beaten base hero with the party\'s one Recruit Contract', () => {
  const [screen] = screensOf('firstLight.contracts');
  assert.ok(screen.kind === 'contract');
  const party = chapterOf('firstLight.contracts').party!;
  assert.ok(heroes[screen.offer.heroId] && !heroes[screen.offer.heroId].unlock, 'a base hero');
  assert.ok(!party.some((spec) => spec.heroId === screen.offer.heroId), 'not one the party already holds');
  const run = storyParty(party, allCombatants);
  assert.strictEqual(run.recruitContracts, 1);
  const offer = storyEntry(screen.offer, heroes[screen.offer.heroId]);
  const signed = claimContract(run, deriveContractOffer(offer), offer.rosterId);
  assert.deepStrictEqual([signed.roster.length, signed.recruitContracts], [party.length + 1, 0]);
});

test('lessons: no passive fires in a guided lesson, and no foe in First Light wears the Mark', () => {
  for (const beat of beats) {
    const board = open(beat.fight);
    const quiet = Object.values(board.combatants).filter((c) => c.side === 'B' || beat.fight.guide.length > 0);
    for (const c of quiet) assert.deepStrictEqual(Object.keys(c.passives), [], `${beat.fight.id}: ${c.combatantId} fights with a passive`);
  }
  for (const beat of guided) {
    const fired = play(beat.fight).rounds.flat().filter((e) => e.type === 'PassiveTriggered');
    assert.deepStrictEqual(fired, [], `${beat.fight.id} fires a passive`);
  }
});

test('lessons: in the open fight only Cairn holds a passive, the one the Passives page is built on', () => {
  const board = open(beats[beats.length - 1].fight);
  const holders = Object.values(board.combatants).filter((c) => Object.keys(c.passives).length > 0).map((c) => c.combatantId);
  assert.deepStrictEqual(holders, ['A:cairn']);
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
