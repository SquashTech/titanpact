import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { progressionTable } from '../src/data/progression';
import { equipment } from '../src/data/equipment';
import { passives } from '../src/data/passives';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { TRIAL_LIST, suggestedSlotFor } from '../src/data/trials';
import { TRIAL_CLEAR_STARS, createProfile, decodeProfile, recordTrialCleared, trialStars } from '../src/run/profile';
import { starsEarned } from '../src/run/starShop';
import { parseEquipmentId } from '../src/run/equipment';
import { buildCombatState } from '../src/run/buildCombatState';
import { gradeExpectedPoints, levelOf } from '../src/run/growth';
import { innatePassiveIdsFor } from '../src/run/innate';
import { MASTERY_CAP } from '../src/run/mastery';
import {
  CONSTRUCTED_LEVEL,
  TEAM_SIZE,
  constructedEntry,
  constructedHeroIds,
  constructedMovePool,
  constructedSide,
  expectedGrowthGrants,
  isTeamReady,
  setItem,
  slotTypes,
  teamExposure,
  toggleMove,
  withPath,
  slotProblems,
  teamProblems,
  type ConstructedContent,
  type Team,
  type TeamSlot,
} from '../src/run/constructed';

const content: ConstructedContent = { heroes, table: progressionTable, equipment };

const cinder = (over: Partial<TeamSlot> = {}): TeamSlot => ({
  heroId: 'cinderKnight',
  pathId: 'cinderKnight-ironclad',
  moveIds: ['singe', 'setAlight', 'kindle'],
  itemIds: ['sword.mythic.blazing', 'plate.mythic'],
  ...over,
});

function typeTeam(type: string): Team {
  const six = Object.values(heroes).filter((h) => h.types[0] === type).slice(0, TEAM_SIZE);
  return {
    name: type,
    slots: six.map((h) => ({ heroId: h.id, pathId: progressionTable.evolutions[h.id][0].paths[0].id, moveIds: [...h.moveIds], itemIds: [] })),
  };
}

test('constructed: growth is the expected line, every roll at its grade mean', () => {
  const grants = expectedGrowthGrants(heroes.cinderKnight);
  assert.strictEqual(grants.hp, Math.round((CONSTRUCTED_LEVEL - 1) * gradeExpectedPoints('S') * 3));
  assert.strictEqual(grants.attack, Math.round((CONSTRUCTED_LEVEL - 1) * gradeExpectedPoints('A')));
  assert.deepStrictEqual(expectedGrowthGrants(heroes.cinderKnight), grants);
});

test('constructed: a legal slot has no problems', () => {
  assert.deepStrictEqual(slotProblems(content, cinder()), []);
});

test('constructed: the pool holds the kit, the path line and the signature, and no Class move', () => {
  const pool = constructedMovePool(content, cinder());
  for (const id of ['singe', 'kindle', 'hammerbrand'] as const) assert.ok(pool.includes(id), id);
  assert.ok(!pool.includes('feint'), 'Constructed has no Classes');
});

test('constructed: illegal slots say why', () => {
  assert.ok(slotProblems(content, cinder({ moveIds: [] })).length > 0);
  assert.ok(slotProblems(content, cinder({ moveIds: ['singe', 'setAlight', 'kindle', 'moltenLash', 'firebrand'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ moveIds: ['singe', 'singe'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ moveIds: ['singe', 'tidalWave'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ pathId: 'crimson-cinderveil' })).length > 0);
  assert.ok(slotProblems(content, cinder({ itemIds: ['sword.epic'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ itemIds: ['sword.mythic', 'sword.mythic.blazing'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ itemIds: ['sword.mythic', 'plate.mythic', 'ring.mythic', 'boots.mythic'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ itemIds: ['worldbreaker'] })).length > 0, 'a Unique is Mythic but not a family');
  assert.ok(slotProblems(content, cinder({ itemIds: ['worldbreaker.blazing'] })).length > 0);
});

test('constructed: the hero gate reads any starred path', () => {
  const unlocked = constructedHeroIds({ evolutionStars: { cinderKnight: ['cinderKnight-ironclad'], crimson: [] } });
  assert.deepStrictEqual([...unlocked], ['cinderKnight']);
  assert.deepStrictEqual(slotProblems(content, cinder({ pathId: 'cinderKnight-thunderblaze', moveIds: ['singe'] }), unlocked), []);
  assert.ok(slotProblems(content, { ...cinder(), heroId: 'crimson', pathId: null, moveIds: ['ember'] }, unlocked).length > 0);
});

test('constructed: a team is six distinct heroes', () => {
  const team = typeTeam('Fire');
  assert.ok(isTeamReady(content, team));
  assert.ok(!isTeamReady(content, { ...team, slots: team.slots.slice(1) }));
  assert.ok(teamProblems(content, { ...team, slots: [...team.slots.slice(0, 5), team.slots[0]] }).length > 0);
});

test('constructed: the entry is level 30, mastered, evolved, and holds exactly the slot', () => {
  const entry = constructedEntry(content, cinder());
  assert.strictEqual(levelOf(entry), CONSTRUCTED_LEVEL);
  assert.strictEqual(entry.mastery, MASTERY_CAP);
  assert.deepStrictEqual(innatePassiveIdsFor(heroes.cinderKnight, entry), heroes.cinderKnight.masteredPassiveIds);
  assert.deepStrictEqual(entry.chosenPathIds, ['cinderKnight-ironclad']);
  assert.strictEqual(entry.evolutionTypeGraft, 'Iron');
  assert.ok(entry.evolutionPassiveGrants.includes('cinderguard'));
  assert.deepStrictEqual(entry.unlockedMoveIds, ['singe', 'setAlight', 'kindle']);
  assert.deepStrictEqual(entry.equipment, ['sword.mythic.blazing', 'plate.mythic']);
  assert.strictEqual(entry.classId, null);
});

test('constructed: a rewire trades base and growth', () => {
  const entry = constructedEntry(content, cinder({ pathId: 'cinderKnight-explosive', moveIds: ['immolate'] }));
  const own = (stat: 'attack' | 'intelligence') => heroes.cinderKnight.baseStats[stat] + (entry.growthStatGrants[stat] ?? 0);
  assert.strictEqual(entry.evolutionStatGrants.attack, own('intelligence') - own('attack'));
  assert.ok(entry.offenseSwapped);
});

test('constructed: two teams build a fight — authored leads on one side, picked in the fight on the other', () => {
  const player = constructedSide(content, typeTeam('Fire'));
  const waterIds = typeTeam('Water').slots.map((s) => s.heroId);
  const ai = constructedSide(content, typeTeam('Water'), [waterIds[0], waterIds[1]]);
  assert.deepStrictEqual(player.squad.activeIds, [null, null]);
  assert.deepStrictEqual(player.run.consumables, { hpPotion: 0, mpPotion: 0, revive: 0 });
  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad: player.squad, roster: player.run.roster },
    { side: 'B', squad: ai.squad, roster: ai.run.roster },
  ], passives);
  assert.strictEqual(Object.keys(state.combatants).length, TEAM_SIZE * 2);
  for (const c of Object.values(state.combatants)) assert.ok(c.currentHp > 0 && c.currentMana > 0);
});

// --- The Trials (src/data/trials.ts) ---

test('trials: every Trial is a ready team, legal with no gate', () => {
  for (const trial of TRIAL_LIST) assert.ok(isTeamReady(content, trial.team), `${trial.id}: ${teamProblems(content, trial.team).join('; ')}`);
});

test('trials: a Trial fields exactly its type’s six', () => {
  for (const trial of TRIAL_LIST) {
    const six = Object.values(heroes).filter((h) => h.types[0] === trial.type).map((h) => h.id).sort();
    assert.deepStrictEqual(trial.team.slots.map((s) => s.heroId).sort(), six, trial.id);
  }
});

test('trials: the leads stand on the team and build a side', () => {
  for (const trial of TRIAL_LIST) {
    const side = constructedSide(content, trial.team, trial.leads);
    assert.deepStrictEqual(side.squad.activeIds, [...trial.leads], trial.id);
  }
});

test('trials: no Unique on any team', () => {
  for (const trial of TRIAL_LIST) {
    const uniques = trial.team.slots.flatMap((s) => s.itemIds).map((id) => parseEquipmentId(id)).filter((p) => p.rarity === null).map((p) => p.base);
    assert.deepStrictEqual(uniques, [], trial.id);
  }
});

test('trials: a Trial answers every type that hits it super-effectively', () => {
  for (const trial of TRIAL_LIST) {
    const threats = Object.keys(typeChart).filter((attacker) => (typeChart[attacker][trial.type] ?? 1) > 1);
    const attackTypes = new Set(
      trial.team.slots.flatMap((s) => s.moveIds).map((id) => moves[id]).filter((m) => m && m.kind === 'damage' && !m.typeFollowsUser).map((m) => m.type)
    );
    const declared = new Set(trial.uncovered ?? []);
    for (const threat of threats) {
      const answered = [...attackTypes].some((t) => (typeChart[t][threat] ?? 1) > 1);
      if (declared.has(threat)) assert.ok(!answered, `${trial.id} declares ${threat} uncovered but answers it`);
      else assert.ok(answered, `${trial.id} has nothing super-effective into ${threat}`);
    }
  }
});

// --- The builder's verbs ---

test('builder: a new path keeps the moves its pool still holds and drops the old line', () => {
  const thunder = cinder({ pathId: 'cinderKnight-thunderblaze', moveIds: ['hammerbrand', 'stormLash', 'setAlight'] });
  assert.deepStrictEqual(withPath(content, thunder, 'cinderKnight-ironclad').moveIds, ['hammerbrand', 'setAlight']);
  assert.deepStrictEqual(slotTypes(content, thunder), ['Fire', 'Storm']);
});

test('builder: a move toggles, and a fifth is refused', () => {
  const full = cinder({ moveIds: ['singe', 'setAlight', 'kindle', 'heavyBlow'] });
  assert.deepStrictEqual(toggleMove(full, 'rendArmor'), full);
  assert.deepStrictEqual(toggleMove(full, 'kindle').moveIds, ['singe', 'setAlight', 'heavyBlow']);
});

test('builder: an item fills a socket, and a family held elsewhere leaves it', () => {
  const slot = cinder({ itemIds: ['sword.mythic', 'plate.mythic'] });
  assert.deepStrictEqual(setItem(slot, 2, 'ring.mythic').itemIds, ['sword.mythic', 'plate.mythic', 'ring.mythic']);
  assert.deepStrictEqual(setItem(slot, 1, 'sword.mythic.blazing').itemIds, ['sword.mythic.blazing']);
  assert.deepStrictEqual(setItem(slot, 0, null).itemIds, ['plate.mythic']);
  assert.deepStrictEqual(slotProblems(content, setItem(slot, 1, 'sword.mythic.blazing')), []);
});

test('builder: exposure reads grafts — five Fire heroes on their Kindling paths are Stone ×4, Arcane ×3 with no answer', () => {
  const kindling = TRIAL_LIST.find((t) => t.id === 'fire')!;
  const team = { name: 'Ember Line', slots: kindling.team.slots.filter((s) => s.heroId !== 'crimson') };
  const read = Object.fromEntries(teamExposure(content, team, typeChart, moves).map((e) => [e.type, e]));
  assert.deepStrictEqual([read.Stone.hits, read.Stone.answers], [4, 2]);
  assert.deepStrictEqual([read.Arcane.hits, read.Arcane.answers], [3, 0]);
});

test('builder: every hero has a Suggested build, and it is legal', () => {
  for (const hero of Object.values(heroes)) {
    const slot = suggestedSlotFor(hero.id);
    assert.ok(slot, `${hero.id} has no Suggested build`);
    assert.deepStrictEqual(slotProblems(content, slot!), [], hero.id);
  }
});

test('builder: teams survive the profile, and an unreadable slot is dropped, not the team', () => {
  const team = { name: 'Ember Line', slots: [cinder(), { heroId: '' } as unknown as TeamSlot] };
  const decoded = decodeProfile(JSON.parse(JSON.stringify({ ...createProfile(), constructedTeams: [team] })));
  assert.deepStrictEqual(decoded.constructedTeams, [{ name: 'Ember Line', slots: [cinder()] }]);
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify({ ...createProfile(), constructedTeams: undefined }))).constructedTeams, []);
});

// --- The Trials record and its stars (docs/constructed.md §7) ---

test('trials record: a first clear is recorded once, and a replay changes nothing', () => {
  const once = recordTrialCleared(createProfile(), 'fire');
  assert.deepStrictEqual(once.trialsCleared, ['fire']);
  assert.strictEqual(recordTrialCleared(once, 'fire'), once);
});

test('trials record: each Trial beaten pays TRIAL_CLEAR_STARS into the balance, derived from the set', () => {
  const before = starsEarned(createProfile());
  const two = recordTrialCleared(recordTrialCleared(createProfile(), 'fire'), 'water');
  assert.strictEqual(trialStars(two), 2 * TRIAL_CLEAR_STARS);
  assert.strictEqual(starsEarned(two) - before, 2 * TRIAL_CLEAR_STARS);
});

test('trials record: it survives the profile, deduplicated', () => {
  const decoded = decodeProfile(JSON.parse(JSON.stringify({ ...createProfile(), trialsCleared: ['fire', 'fire', 'water', 7] })));
  assert.deepStrictEqual(decoded.trialsCleared, ['fire', 'water']);
});
