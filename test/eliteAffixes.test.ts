import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { statuses } from '../src/data/statuses';
import { passives, eliteOpeningFieldPassiveFor, titansMarkFor, ELITE_WARD_SHARE } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { ELITE_AFFIXES } from '../src/data/eliteAffixes';
import { dressElite, eliteAffixCountFor, eliteFieldPool, rollEliteDressing } from '../src/run/eliteAffixes';
import { boonPool } from '../src/run/boons';
import { generateEncounter } from '../src/run/enemyGen';
import { encounterScaling } from '../src/run/difficulty';
import { progressionTable } from '../src/data/progression';
import { addRosterEntry, createRosterEntry, createRunState } from '../src/run/state';
import { resolveBattleStartEntries } from '../src/engine/combat/passiveEngine';
import { getMaxHp } from '../src/engine/state';
import type { TypeId } from '../src/engine/content';

// --- The draw (docs/guild-hall-overhaul.md §4) ---

test('eliteAffixes: one affix in Acts 1-2 and two in Acts 3-4, distinct, the same for the same seed', () => {
  for (let act = 1; act <= 4; act++) {
    for (let seed = 1; seed <= 30; seed++) {
      const dressing = rollEliteDressing(seed, act, ['Fire']);
      assert.strictEqual(dressing.affixIds.length, act <= 2 ? 1 : 2);
      assert.strictEqual(eliteAffixCountFor(act), dressing.affixIds.length);
      assert.strictEqual(new Set(dressing.affixIds).size, dressing.affixIds.length);
      assert.ok(dressing.affixIds.every((id) => ELITE_AFFIXES.some((a) => a.id === id)));
      assert.deepStrictEqual(rollEliteDressing(seed, act, ['Fire']), dressing);
    }
  }
});

test('eliteAffixes: the field is one of the types the Elite fields, any field when none is, never the Titan\'s', () => {
  assert.deepStrictEqual(eliteFieldPool(['Fire', 'Water']).sort(), ['downpour', 'scorchedLand']);
  const any = eliteFieldPool(['Iron' as TypeId]);
  assert.ok(any.length > 2 && !any.includes('witheringGaze'));
  for (let seed = 1; seed <= 20; seed++) assert.ok(['bloodMoon'].includes(rollEliteDressing(seed, 1, ['Beast']).fieldEffectId));
});

test('eliteAffixes: an affix or an opening field is in no Boon pool', () => {
  let run = createRunState();
  for (const id of ['cinderKnight', 'ironWarden', 'tidecaller']) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  const pool = new Set(boonPool(run.roster, heroes));
  const ids = [...ELITE_AFFIXES.flatMap((a) => (a.passiveId ? [a.passiveId] : [])), ...Object.values(eliteOpeningFieldPassiveFor)];
  for (const id of ids) {
    assert.ok(passives[id], `${id} is not a passive`);
    assert.ok(!pool.has(id), `${id} is offered as a Boon`);
  }
});

test('eliteAffixes: every enemy wears each affix, Marked gives each its own type\'s Mark, and only the lead opens the field', () => {
  const encounter = generateEncounter('elite', 5, heroes, { scaling: encounterScaling('elite', 3), progression: progressionTable });
  const dressed = dressElite(encounter, { affixIds: ['warded', 'marked'], fieldEffectId: 'bedrock' }, heroes);
  const leadId = encounter.squad.activeIds.find((id) => id !== null);
  for (const entry of dressed.run.roster) {
    const before = encounter.run.roster.find((e) => e.rosterId === entry.rosterId)!;
    const added = entry.bonusPassiveGrants.slice(before.bonusPassiveGrants.length);
    assert.ok(added.includes('eliteWarded'));
    const mark = titansMarkFor[heroes[entry.heroId].types[0] as keyof typeof titansMarkFor];
    if (mark) assert.ok(added.includes(mark), `${entry.heroId} is not Marked`);
    assert.strictEqual(added.includes(eliteOpeningFieldPassiveFor.bedrock), entry.rosterId === leadId);
  }
});

// --- In the fight ---

function opened(passiveId: string) {
  const built = createFightState(
    17,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
  const b1 = built.combatants.b1;
  const state = { ...built, combatants: { ...built.combatants, b1: { ...b1, passives: { [passiveId]: { passiveId, stacks: 1 } } } } };
  return resolveBattleStartEntries(state, 1, heroes, statuses, passives, fieldEffects).state;
}

test('eliteAffixes: Warded opens on a Shield of a fifth of max HP; Swift opens a stage faster; the field is up from round 1', () => {
  const warded = opened('eliteWarded').combatants.b1;
  assert.strictEqual(warded.statuses.Shield?.magnitude, Math.round(getMaxHp(heroes.ironWarden, warded) * ELITE_WARD_SHARE));
  assert.strictEqual(opened('eliteSwift').combatants.b1.statStages?.speed, 1);
  assert.strictEqual(opened(eliteOpeningFieldPassiveFor.downpour).activeFieldEffect?.fieldEffectId, 'downpour');
});
