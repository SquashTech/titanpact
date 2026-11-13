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
import { sky, TUTORIAL_STAR } from '../src/data/sky';
import { TUTORIAL_CUES, TUTORIAL_FIGHT, TUTORIAL_OPEN_FOES, TUTORIAL_ROAD } from '../src/data/tutorial';
import { buildCombatState } from '../src/run/buildCombatState';
import { decodeProfile } from '../src/run/profile';
import { isConstellationLit } from '../src/run/sky';
import { guidedAction, guidedReplacement, scriptedEnemyActions, storySides, withStoryEnds, STORY_ENEMY_SIDE, STORY_PLAYER_SIDE, type StoryFight } from '../src/run/story';
import { partyAfterFight } from '../src/run/tutorial';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { resolveBattleStartEntries, resolvePassiveReactions } from '../src/engine/combat/passiveEngine';
import { applyForcedReplacement, replacementCandidates } from '../src/engine/combat/switching';
import { fightWinner, getMaxHp, type CombatState } from '../src/engine/state';
import type { CombatEvent } from '../src/engine/events';

const config = { heroes: allCombatants, moves, typeChart, statuses, passives, fieldEffects, benchHpRegenFlat: 10 };
const id = (side: 'A' | 'B', rosterId: string) => `${side}:${rosterId}`;

/** The fight played to the script's end: each round's events, the board after it, and the replacements sent. */
function play(fight: StoryFight) {
  const sides = storySides(fight, allCombatants);
  const leads = fight.guidedLeads ?? [];
  const squad = { activeIds: [leads[0] ?? null, leads[1] ?? null] as [string | null, string | null], benchIds: sides.player.run.roster.map((r) => r.rosterId).filter((r) => !leads.includes(r)) };
  const built = buildCombatState(fight.seed, allCombatants, equipment, [
    { side: STORY_PLAYER_SIDE, squad, roster: sides.player.run.roster },
    { side: STORY_ENEMY_SIDE, squad: sides.ai.squad, roster: sides.ai.run.roster },
  ], passives);
  let state: CombatState = resolveBattleStartEntries(withStoryEnds(built, fight), 1, allCombatants, statuses, passives, fieldEffects).state;
  const rounds: CombatEvent[][] = [];
  const boards: CombatState[] = [state];
  const sent: string[] = [];
  while (state.round <= fight.guide.length && fightWinner(state) === null) {
    const player = state.active.A.filter((c): c is string => !!c && !state.combatants[c].fainted).map((c) => guidedAction(fight, state, c)!);
    const result = resolveRound(state, [...player, ...(scriptedEnemyActions(fight, state) ?? [])], config);
    state = result.state;
    for (const side of ['B', 'A'] as const) {
      for (const slot of [0, 1] as const) {
        const bench = replacementCandidates(state, side);
        if (state.active[side][slot] !== null || bench.length === 0) continue;
        const inId = side === 'A' ? id('A', guidedReplacement(fight, bench.map((c) => c.slice(2)))!) : bench[0];
        if (side === 'A') sent.push(inId);
        const r = applyForcedReplacement(state, state.round, side, slot, inId, statuses);
        state = resolvePassiveReactions(r.state, r.state.round, r.events, allCombatants, statuses, passives, fieldEffects).state;
      }
    }
    rounds.push(result.events);
    boards.push(state);
  }
  return { rounds, boards, sent, state };
}

const dealt = (events: CombatEvent[], to: string) => events.filter((e) => e.type === 'DamageDealt' && e.targetCombatantId === to);
const fainted = (events: CombatEvent[]) => events.filter((e) => e.type === 'Fainted').map((e) => (e as { combatantId: string }).combatantId).sort();

const played = play(TUTORIAL_FIGHT);
const [r1, r2, r3, r4, r5, r6, r7] = played.rounds;

test('tutorial: round 1 drops both leads to the hits their types are weak to, the fastest first', () => {
  assert.deepStrictEqual(fainted(r1), [id('B', 'pud'), id('B', 'sprout')]);
  const first = r1.find((e) => e.type === 'DamageDealt');
  assert.strictEqual(first && first.type === 'DamageDealt' && first.sourceCombatantId, id('A', 'raiju'));
  for (const e of r1) if (e.type === 'DamageDealt') assert.strictEqual(e.typeMult, 2);
});

test('tutorial: round 2 switches Cairn in, and Stone takes both hits at half', () => {
  assert.ok(r2.some((e) => e.type === 'SwitchedIn' && e.inCombatantId === id('A', 'cairn')));
  const taken = dealt(r2, id('A', 'cairn'));
  assert.strictEqual(taken.length, 2);
  for (const e of taken) assert.ok(e.type === 'DamageDealt' && e.typeMult === 0.5);
  assert.deepStrictEqual(fainted(r2), []);
});

test('tutorial: round 3\'s spread drops both foes', () => {
  assert.deepStrictEqual(fainted(r3), [id('B', 'arc'), id('B', 'kindle')]);
  assert.ok(r3.filter((e) => e.type === 'DamageDealt' && e.moveId === 'tremor').length === 2);
});

test('tutorial: round 4\'s physical hit lands more than twice the spread\'s magic on the high-Wisdom foe', () => {
  const on = dealt(r4, id('B', 'mesmerid'));
  const amount = (moveId: string) => (on.find((e) => e.type === 'DamageDealt' && e.moveId === moveId) as { amount: number } | undefined)?.amount ?? 0;
  assert.ok(amount('singe') > 2 * amount('tremor'), `${amount('singe')} against ${amount('tremor')}`);
});

test('tutorial: round 5 finds Cinder unable to pay for any move, and it Rests', () => {
  const cinder = played.boards[4].combatants[id('A', 'cinder')];
  for (const moveId of TUTORIAL_FIGHT.player[0].moveIds!) assert.ok(cinder.currentMana < moves[moveId].manaCost, moveId);
  assert.ok(r5.some((e) => e.type === 'Rested' && e.combatantId === id('A', 'cinder')));
});

test('tutorial: round 6 knocks Cairn out, and the Burn finishes the foe it was set on', () => {
  assert.deepStrictEqual(fainted(r6), [id('A', 'cairn'), id('B', 'mesmerid')]);
  const tick = r6.findIndex((e) => e.type === 'StatusTicked' && e.statusId === 'Burn' && e.combatantId === id('B', 'mesmerid'));
  const fall = r6.findIndex((e) => e.type === 'Fainted' && e.combatantId === id('B', 'mesmerid'));
  assert.ok(tick >= 0 && fall > tick, 'the Burn tick is what drops it');
  assert.deepStrictEqual(played.sent, [id('A', 'solace')]);
});

test('tutorial: round 7 heals, and the party leaves hurt with one hero down and the last foe standing', () => {
  assert.ok(r7.some((e) => e.type === 'Healed' && e.targetCombatantId === id('A', 'cinder')));
  assert.strictEqual(fightWinner(played.state), null);
  assert.ok(!played.state.combatants[id('B', 'ravager')].fainted);
  const cinder = played.state.combatants[id('A', 'cinder')];
  assert.ok(cinder.currentHp < getMaxHp(allCombatants[cinder.heroId], cinder) * 0.75);
});

test('tutorial: rolls are fixed, so the script plays the same on any seed', () => {
  const again = play({ ...TUTORIAL_FIGHT, seed: TUTORIAL_FIGHT.seed + 99 });
  const amounts = (rounds: CombatEvent[][]) => rounds.map((events) => events.filter((e) => e.type === 'DamageDealt').map((e) => (e as { amount: number }).amount));
  assert.deepStrictEqual(amounts(again.rounds), amounts(played.rounds));
  assert.ok(played.rounds.flat().every((e) => e.type !== 'DamageDealt' || !e.isCrit));
});

test('tutorial: one prompt a round, the leads and the replacement included', () => {
  const rounds = TUTORIAL_CUES.filter((c) => !c.at).map((c) => c.round);
  assert.deepStrictEqual(rounds, Array.from({ length: TUTORIAL_FIGHT.guide.length + 1 }, (_, i) => i + 1));
  for (const cue of TUTORIAL_CUES) assert.strictEqual(cue.tips?.length, 1);
  assert.ok(TUTORIAL_CUES.some((c) => c.at === 'leads') && TUTORIAL_CUES.some((c) => c.at === 'replacement'));
});

test('tutorial: a base hero of a type of its own each, physical and magical, and a healer', () => {
  const party = TUTORIAL_FIGHT.player.map((s) => heroes[s.heroId]);
  for (const hero of party) assert.ok(hero && !hero.unlock, hero?.id);
  assert.strictEqual(new Set(party.map((h) => h.types[0])).size, party.length);
  const kinds = TUTORIAL_FIGHT.player.flatMap((s) => s.moveIds ?? []).map((m) => moves[m]);
  assert.ok(kinds.some((m) => m.category === 'physical' && m.kind === 'damage'));
  assert.ok(kinds.some((m) => m.category === 'magical' && m.kind === 'damage'));
  assert.ok(kinds.some((m) => m.kind === 'heal'));
  for (const spec of TUTORIAL_OPEN_FOES) assert.ok(allCombatants[spec.heroId], spec.heroId);
});

test('tutorial: the party walks the road with its wounds, Cairn down, every innate awake', () => {
  const party = storySides(TUTORIAL_FIGHT, allCombatants).player.run;
  const run = partyAfterFight(party, played.state, allCombatants, TUTORIAL_ROAD, 'wildsEdge');
  assert.ok(run.roster.find((r) => r.rosterId === 'cairn')!.down);
  assert.ok(run.roster.every((r) => !r.innateQuiet));
  assert.deepStrictEqual(run.map!.rows.map((row) => run.map!.nodes[row[0]].type), [...TUTORIAL_ROAD]);
  assert.deepStrictEqual(run.map!.startNodeIds, [run.map!.rows[0][0]]);
});

test('tutorial: a file that won First Light has the tutorial lit and keeps the Stardust it was paid', () => {
  const won = decodeProfile({ version: 3, litStars: ['firstLight.move', 'firstLight.open'], seenTipIds: ['sky.lit.firstLight.open', 'sky.lit.firstLight'], bonusStardust: 50 });
  assert.deepStrictEqual(won.litStars, [TUTORIAL_STAR]);
  assert.ok(won.seenTipIds.includes(`sky.lit.${TUTORIAL_STAR}`) && won.seenTipIds.includes('sky.lit.firstLight'));
  assert.strictEqual(won.bonusStardust, 250);
  assert.ok(isConstellationLit(won, sky.constellations.firstLight));
  const partway = decodeProfile({ version: 3, litStars: ['firstLight.move', 'firstLight.mana'] });
  assert.deepStrictEqual(partway.litStars, []);
  assert.strictEqual(partway.bonusStardust, 0);
});
