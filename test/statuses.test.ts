// Status conditions (docs/conditions.md).

import { statusApplicationsOf, STAT_ORDER } from '../src/engine/content';
import type { StatKey } from '../src/engine/content';
import * as assert from 'assert';
import { test } from './harness';
import { createFightState, fixtureMaxHp } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { getEffectiveStat, hasStatus } from '../src/engine/state';
import { applyStatus, cleanseStatuses, selectableTargets } from '../src/engine/combat/statusEngine';
import { resolveStatusMagnitudeFor, scaleStatusMagnitude } from '../src/engine/status/statusMagnitude';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

function twoVTwoFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

/** Enough mana for any single cast, so a fixture never Rests instead of casting. */
function deepMana<T extends { combatants: Record<string, any> }>(state: T): T {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [id, { ...c, currentMana: 999, statModifiers: { ...c.statModifiers, manaPool: 999 } }])
  );
  return { ...state, combatants };
}

function withStatus(
  state: ReturnType<typeof twoVTwoFixture>,
  combatantId: string,
  statusId: string,
  fields: { magnitude?: number; duration?: number }
) {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: { statusId, ...fields } } },
    },
  };
}

// --- Daze: flinch ---

test('status: Daze blocks a move action — no MoveUsed, mana untouched, ActionBlocked emitted', () => {
  const state = withStatus(twoVTwoFixture(100), 'a1', 'Daze', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(events.some((e) => e.type === 'MoveUsed'), false);
  assert.strictEqual(events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'a1' && e.reason === 'dazed'), true);
  assert.strictEqual(next.combatants.a1.currentMana, heroes.cinderKnight.baseStats.manaPool);
  assert.strictEqual(next.combatants.b1.currentHp, fixtureMaxHp('ironWarden'));
});

test('status: Daze is gone by the end of the round it was applied in — nobody ever starts a round Dazed', () => {
  const state = withStatus(twoVTwoFixture(101), 'a1', 'Daze', {});
  const { state: next, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }],
    config
  );

  assert.strictEqual(hasStatus(next.combatants.a1, 'Daze'), false);
  assert.strictEqual(
    events.some((e) => e.type === 'StatusRemoved' && e.combatantId === 'a1' && e.statusId === 'Daze' && e.reason === 'expired'),
    true,
    'the clear is an event, so the view can drop the badge'
  );
  assert.strictEqual(statuses.Daze.shape, 'boolean');
  assert.strictEqual(statuses.Daze.clearsAtEndOfRound, true);
});

test('status: a Daze only denies a turn when its applier moved first — flinch, not a purchased turn', () => {
  // Blind is the guaranteed Daze applier. cinderKnight (speed 50) vs ironWarden (30).
  const fast = resolveRound(
    twoVTwoFixture(102),
    [
      { kind: 'move', combatantId: 'a1', moveId: 'blind', declaredTarget: 'b1' },
      { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' },
    ],
    config
  );
  assert.strictEqual(
    fast.events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'b1' && e.reason === 'dazed'),
    true,
    'the slower hero never gets to swing'
  );

  const slow = resolveRound(
    twoVTwoFixture(102),
    [
      { kind: 'move', combatantId: 'b1', moveId: 'blind', declaredTarget: 'a1' },
      { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' },
    ],
    config
  );
  assert.strictEqual(
    slow.events.some((e) => e.type === 'ActionBlocked'),
    false,
    'a Daze landed on a hero that already acted is worth nothing at all'
  );
  assert.strictEqual(hasStatus(slow.state.combatants.a1, 'Daze'), false, 'and is gone before it could ever matter');
});

// --- Freeze: halves Speed, including in turn-order resolution ---

test('status: Freeze halves Speed (floored) and does not touch other stats', () => {
  const state = twoVTwoFixture(150);
  const frozen = withStatus(state, 'b1', 'Freeze', {});
  const hero = heroes.ironWarden;

  assert.strictEqual(getEffectiveStat(hero, state.combatants.b1, 'speed'), hero.baseStats.speed);
  assert.strictEqual(getEffectiveStat(hero, frozen.combatants.b1, 'speed'), Math.floor(hero.baseStats.speed / 2));
  assert.strictEqual(getEffectiveStat(hero, frozen.combatants.b1, 'attack'), hero.baseStats.attack);
  assert.ok(hasStatus(frozen.combatants.b1, 'Freeze'));
});

test('status: a frozen combatant with higher base Speed is outsped by a faster-after-halving opponent', () => {
  // Both moves are priority 0, so Speed is the only tiebreak.
  const state = twoVTwoFixture(151);
  const frozen = withStatus(state, 'b1', 'Freeze', {});
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a2', moveId: 'splash', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a2' },
  ];
  const { events } = resolveRound(frozen, actions, config);
  const moveUsedOrder = events.filter((e) => e.type === 'MoveUsed').map((e: any) => e.combatantId);
  assert.deepStrictEqual(moveUsedOrder, ['a2', 'b1']);
});

// --- Renew: the positive mirror of Burn ---

test('status: Renew heals at end of round and decays by halving, like Burn', () => {
  const state = twoVTwoFixture(106);
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const regenerating = withStatus(hurt, 'a1', 'Renew', { magnitude: 20 });

  const { state: afterRound1, events } = resolveRound(regenerating, [], config);
  assert.strictEqual(afterRound1.combatants.a1.currentHp, 30); // 10 + 20
  assert.strictEqual(afterRound1.combatants.a1.statuses.Renew.magnitude, 10); // floor(20/2)
  assert.ok(events.some((e) => e.type === 'StatusTicked' && e.statusId === 'Renew' && e.kind === 'heal' && e.amount === 20));

  const { state: afterRound2 } = resolveRound(afterRound1, [], config);
  assert.strictEqual(afterRound2.combatants.a1.currentHp, 40); // 30 + 10
  assert.strictEqual(afterRound2.combatants.a1.statuses.Renew.magnitude, 5); // floor(10/2)
});

test('status: Burn/Renew decay to 0 removes the status entirely', () => {
  const state = twoVTwoFixture(107);
  const burning = withStatus(state, 'b1', 'Burn', { magnitude: 1 }); // floor(1/2) = 0
  const { state: next, events } = resolveRound(burning, [], config);

  assert.strictEqual(hasStatus(next.combatants.b1, 'Burn'), false);
  assert.ok(events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Burn' && e.reason === 'decay'));
});

// --- Cleanse: always spares positive statuses ---

test('status: cleanseStatuses strips every non-positive status, leaving Renew (positive) alone', () => {
  const state = twoVTwoFixture(108);
  let afflicted = withStatus(state, 'a1', 'Bleed', {});
  afflicted = withStatus(afflicted, 'a1', 'Poison', { magnitude: 20, duration: 3 });
  afflicted = withStatus(afflicted, 'a1', 'Renew', { magnitude: 15 });

  const { state: cleansed } = cleanseStatuses(afflicted, 1, 'a1', statuses);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Bleed'), false);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Poison'), false);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Renew'), true);
});

// --- Conduct: apply-vs-detonate split off Storm/Iron/Mech hits ---

test('status: Conduct is only applied by its dedicated move, not any Storm/Iron/Mech hit', () => {
  const state = twoVTwoFixture(200);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'ironFist', declaredTarget: 'b1' }]; // Iron-typed, no statusApplication
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(hasStatus(next.combatants.b1, 'Conduct'), false);
  assert.strictEqual(events.some((e) => e.type === 'StatusApplied' && e.statusId === 'Conduct'), false);
});

test('status: Conduct applies via a move that names it (stormLash) — no bonus damage yet', () => {
  const state = twoVTwoFixture(200);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'stormLash', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(hasStatus(next.combatants.b1, 'Conduct'));
  assert.ok(events.some((e) => e.type === 'StatusApplied' && e.statusId === 'Conduct' && e.combatantId === 'b1'));
});

test('status: Conduct detonates on the next Storm/Iron/Mech hit — bonus damage, then consumed', () => {
  const state = twoVTwoFixture(201);
  const marked = withStatus(state, 'b1', 'Conduct', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'ironFist', declaredTarget: 'b1' }];

  const plainResult = resolveRound(state, actions, config);
  const markedResult = resolveRound(marked, actions, config);

  const maxHp = fixtureMaxHp('ironWarden');
  const plainDamage = maxHp - plainResult.state.combatants.b1.currentHp;
  const markedDamage = maxHp - markedResult.state.combatants.b1.currentHp;
  const expectedBonus = Math.ceil(maxHp * 0.15);

  assert.strictEqual(markedDamage - plainDamage, expectedBonus);
  assert.strictEqual(hasStatus(markedResult.state.combatants.b1, 'Conduct'), false);
  assert.ok(markedResult.events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Conduct' && e.reason === 'consumed'));
});

// --- Poison: active-only timer, then delayed detonation ---

test('status: Poison counts down while active without dealing damage until the timer hits zero', () => {
  const state = twoVTwoFixture(210);
  const poisoned = withStatus(state, 'b1', 'Poison', { magnitude: 20, duration: 2 });
  const maxHp = fixtureMaxHp('ironWarden');

  const { state: afterRound1 } = resolveRound(poisoned, [], config);
  assert.strictEqual(afterRound1.combatants.b1.statuses.Poison.duration, 1);
  assert.strictEqual(afterRound1.combatants.b1.currentHp, maxHp);

  const { state: afterRound2, events } = resolveRound(afterRound1, [], config);
  const expectedDmg = Math.ceil((maxHp * 20) / 100);
  assert.strictEqual(afterRound2.combatants.b1.currentHp, maxHp - expectedDmg);
  assert.strictEqual(hasStatus(afterRound2.combatants.b1, 'Poison'), false);
  assert.ok(events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Poison' && e.reason === 'expired'));
});

test('status: Poison does not tick while benched — switching stalls the timer instead of clearing it', () => {
  const state = createFightState(
    211,
    [{ combatantId: 'a1', heroId: 'cinderKnight', side: 'A' }],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b3', heroId: 'wildOracle', side: 'B' }, // benched
    ]
  );
  const poisoned = withStatus(state, 'b3', 'Poison', { magnitude: 20, duration: 2 });
  const { state: next } = resolveRound(poisoned, [], config);

  assert.strictEqual(next.combatants.b3.statuses.Poison.duration, 2);
});

test('status: reapplying Poison mid-timer adds to magnitude without resetting the duration', () => {
  const state = twoVTwoFixture(212);
  const poisoned = withStatus(state, 'b1', 'Poison', { magnitude: 10, duration: 2 });
  const { state: reapplied } = applyStatus(poisoned, 1, 'b1', statuses.Poison, { magnitude: 15, duration: 3 });

  assert.strictEqual(reapplied.combatants.b1.statuses.Poison.magnitude, 25);
  assert.strictEqual(reapplied.combatants.b1.statuses.Poison.duration, 2); // held, not reset to 3
});

// --- Haunt: singleEnemy Spirit/Mind attacks become spread ---

test('status: Haunt turns a singleEnemy Spirit/Mind attack into a spread hit on the Haunted partner', () => {
  const state = twoVTwoFixture(220);
  const haunted = withStatus(state, 'b2', 'Haunt', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulRend', declaredTarget: 'b1' }]; // Spirit-typed

  const { state: next, events } = resolveRound(haunted, actions, config);

  assert.ok(events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1' && !e.viaStatusId));
  assert.ok(events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b2' && e.viaStatusId === 'Haunt'));
  assert.ok(next.combatants.b2.currentHp < fixtureMaxHp('wildOracle'));
});

test('status: a non-Spirit/Mind attack does not trigger Haunt spread', () => {
  const state = twoVTwoFixture(221);
  const haunted = withStatus(state, 'b2', 'Haunt', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }]; // Fire-typed

  const { state: next } = resolveRound(haunted, actions, config);
  assert.strictEqual(next.combatants.b2.currentHp, fixtureMaxHp('wildOracle'));
});

// --- Ambush: a typeless Force, spent on the next attack ---

/** Side A carries a bench hero so the switch-clearing test has somewhere to go. */
function ambushFixture(seed: number) {
  return deepMana(
    createFightState(
      seed,
      [
        { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
        { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
        { combatantId: 'a3', heroId: 'nightshade', side: 'A' },
      ],
      [
        { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
        { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      ]
    )
  );
}

const forceBonusOn = (events: readonly any[], targetId: string) =>
  events.find((e) => e.type === 'DamageDealt' && e.targetCombatantId === targetId)?.elementalForceBonus;

test('status: Ambush adds its magnitude to Base Power and is spent by the attack that reads it', () => {
  const loaded = withStatus(ambushFixture(240), 'a1', 'Ambush', { magnitude: 45 });
  const action: Action = { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' };
  const { state: next, events } = resolveRound(loaded, [action], config);

  assert.strictEqual(forceBonusOn(events, 'b1'), 45);
  assert.strictEqual(hasStatus(next.combatants.a1, 'Ambush'), false);
  assert.ok(events.some((e) => e.type === 'StatusRemoved' && e.combatantId === 'a1' && e.statusId === 'Ambush' && e.reason === 'consumed'));
});

test('status: Ambush is TYPELESS — it pays on a move that shares nothing with the caster', () => {
  // Cinder Knight is Fire/Iron; Splash is Water, so an Elemental Force would contribute nothing here.
  const loaded = withStatus(ambushFixture(241), 'a1', 'Ambush', { magnitude: 30 });
  const { events } = resolveRound(loaded, [{ kind: 'move', combatantId: 'a1', moveId: 'splash', declaredTarget: 'b1' }], config);

  assert.strictEqual(forceBonusOn(events, 'b1'), 30);
});

test('status: a spread cashes Ambush on BOTH targets and still spends it once', () => {
  const loaded = withStatus(ambushFixture(242), 'a1', 'Ambush', { magnitude: 25 });
  const { state: next, events } = resolveRound(loaded, [{ kind: 'move', combatantId: 'a1', moveId: 'umbralWave' }], config);

  assert.strictEqual(forceBonusOn(events, 'b1'), 25);
  assert.strictEqual(forceBonusOn(events, 'b2'), 25, 'read per hit, so the second target is not shortchanged');
  assert.strictEqual(hasStatus(next.combatants.a1, 'Ambush'), false);
  assert.strictEqual(events.filter((e) => e.type === 'StatusRemoved' && e.statusId === 'Ambush').length, 1);
});

test('status: a buff move never spends Ambush — only an attack cashes it', () => {
  const loaded = withStatus(ambushFixture(243), 'a1', 'Ambush', { magnitude: 25 });
  const { state: next } = resolveRound(loaded, [{ kind: 'move', combatantId: 'a1', moveId: 'weaken', declaredTarget: 'b1' }], config);

  assert.strictEqual(next.combatants.a1.statuses.Ambush?.magnitude, 25);
});

test('status: Ambush stacks additively, and switching to the bench clears it rather than banking it', () => {
  const state = ambushFixture(244);
  const twice = applyStatus(applyStatus(state, 1, 'a1', statuses.Ambush, { magnitude: 20 }).state, 1, 'a1', statuses.Ambush, {
    magnitude: 45,
  }).state;
  assert.strictEqual(twice.combatants.a1.statuses.Ambush?.magnitude, 65);

  const { state: next } = resolveRound(twice, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config);
  assert.strictEqual(hasStatus(next.combatants.a1, 'Ambush'), false, 'no banking a loaded hit on the bench');
});

// --- The magnitude formula (docs/combat.md "Scaled status magnitudes") ---

test('status: a DoT rider scales off the caster stat its own move swings with, and takes STAB', () => {
  // Crimson (Fire, Int 80) casting the MAGICAL Set Alight: 30 x 1.30 x 1.25 = 49.
  // Cinder Knight (Fire/Iron, Attack 85) casting the PHYSICAL Molten Lash: 15 x 1.35 x 1.25 = 25.
  const cast = (heroId: string, moveId: string) => {
    const state = deepMana(
      createFightState(
        700,
        [{ combatantId: 'a1', heroId, side: 'A' }],
        [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
      )
    );
    const applied = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }] as Action[], config);
    const event = applied.events.find((e) => e.type === 'StatusApplied' && e.statusId === 'Burn');
    return event && event.type === 'StatusApplied' ? event.magnitude : null;
  };

  assert.strictEqual(cast('crimson', 'setAlight'), 49);
  assert.strictEqual(cast('cinderKnight', 'moltenLash'), 25);
});

test('status: the same Burn move is worth more in a specialist hand than in an incidental one', () => {
  // The whole point of the formula: identity, not a uniform buff. Read off the data, not
  // pinned — what matters is the ORDER, and that the off-type applier lands under the base.
  const cast = (heroId: string) => {
    const state = deepMana(
      createFightState(
        701,
        [{ combatantId: 'a1', heroId, side: 'A' }],
        [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
      )
    );
    const applied = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a1', moveId: 'setAlight', declaredTarget: 'b1' }] as Action[],
      config
    );
    const event = applied.events.find((e) => e.type === 'StatusApplied' && e.statusId === 'Burn');
    return (event && event.type === 'StatusApplied' ? event.magnitude : 0) ?? 0;
  };

  const authored = statusApplicationsOf(moves.setAlight).find((app) => app.statusId === 'Burn')!.magnitude!;
  const specialist = cast('crimson'); // Fire, Int 80 — the stat term AND STAB
  const incidental = cast('wildOracle'); // Nature, Int 60 — the stat term alone, no STAB

  assert.strictEqual(specialist, 49); // 30 x 1.30 x 1.25
  assert.strictEqual(incidental, 33); // 30 x 1.10, and nothing else
  assert.ok(specialist > authored, `the Fire specialist must beat the authored ${authored}, got ${specialist}`);
  // STAB is the bulk of the gap, which is why the type a hero draws power from is the read.
  assert.ok(specialist > incidental * 1.4, `the spread is too narrow to be an identity: ${specialist} vs ${incidental}`);
});

test('status: a DoT aimed at SELF is a cost — it lands at exactly the authored number', () => {
  // Volcanic Surge's self-Burn must stay knowable before the button is pressed, so the
  // formula never touches it, even though Cinder Knight would otherwise scale it by 1.69.
  const authored = statusApplicationsOf(moves.volcanicSurge).find((app) => app.statusId === 'Burn')!;
  assert.strictEqual(authored.target, 'self');

  const state = deepMana(
    createFightState(
      702,
      [{ combatantId: 'a1', heroId: 'cinderKnight', side: 'A' }],
      [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
    )
  );
  const { events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'volcanicSurge', declaredTarget: 'b1' }] as Action[],
    config
  );
  const applied = events.find((e) => e.type === 'StatusApplied' && e.statusId === 'Burn');
  assert.ok(applied && applied.type === 'StatusApplied');
  assert.strictEqual(applied.type === 'StatusApplied' ? applied.magnitude : null, authored.magnitude);
});

test('status: a HoT aimed at SELF is a benefit, so it still scales', () => {
  // The self exemption is about SIGN, not about the target: Second Wind is the mirror of
  // Volcanic Surge and must go through the formula (45 x Revenant's 0.96 x 1.25 Spirit = 54).
  const state = deepMana(
    createFightState(
      703,
      [{ combatantId: 'a1', heroId: 'revenant', side: 'A' }],
      [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
    )
  );
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'secondWind' }] as Action[], config);
  const applied = events.find((e) => e.type === 'StatusApplied' && e.statusId === 'Renew');
  assert.ok(applied && applied.type === 'StatusApplied');
  assert.strictEqual(applied.type === 'StatusApplied' ? applied.magnitude : null, 54);
});

test('status: the formula is gated on the pipeline — a timer status is scaled by nothing', () => {
  for (const def of Object.values(statuses)) {
    if (def.pipeline === 'hot' || def.pipeline === 'dot') continue;
    assert.notStrictEqual(def.pipeline, undefined, `${def.id} has no pipeline to gate on`);
  }
  // Poison is the one magnitude-carrying status outside both, and its magnitude is a
  // PERCENTAGE of max HP — it already tracks the HP pool and must not be scaled again.
  assert.strictEqual(statuses.Poison.pipeline, 'timer');
});

// The out-of-combat entry point exists so a level-up screen or a hero sheet can print the figure
// a rider will land instead of the authored base. It must never disagree with the fight's answer.
test('status: the sheet formula and the fight formula are the same formula', () => {
  const state = createFightState(
    911,
    [{ combatantId: 'a1', heroId: 'crimson', side: 'A' }],
    [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
  );
  const caster = state.combatants.a1;
  const casterHero = heroes[caster.heroId];
  const sheetCaster = {
    stats: Object.fromEntries(STAT_ORDER.map((stat) => [stat, getEffectiveStat(casterHero, caster, stat)])) as Record<
      StatKey,
      number
    >,
    types: casterHero.types,
  };

  let compared = 0;
  for (const move of Object.values(moves)) {
    for (const app of statusApplicationsOf(move)) {
      const def = statuses[app.statusId];
      if (!def || app.magnitude == null) continue;
      assert.strictEqual(
        resolveStatusMagnitudeFor(app.magnitude, def, app, move, sheetCaster),
        scaleStatusMagnitude(app.magnitude, def, app, move, casterHero, caster),
        `${move.id} / ${def.id} reads differently off a sheet than in a fight`
      );
      compared += 1;
    }
  }
  assert.ok(compared > 40, `only ${compared} riders compared — the sweep found nothing`);
});

test('status: a scaled rider is a BASE, so a low-stat caster lands LESS than the card authored', () => {
  const burn = statuses.Burn;
  const ember = moves.ember;
  const app = statusApplicationsOf(ember).find((a) => a.statusId === 'Burn');
  assert.ok(app?.magnitude != null, 'Ember no longer carries a Burn magnitude');

  // Same move, same card, two Fire heroes: the authored 10 is neither a floor nor a ceiling.
  const hot = { stats: heroes.crimson.baseStats, types: heroes.crimson.types };
  const cold = { stats: heroes.cinderKnight.baseStats, types: heroes.cinderKnight.types };
  const hotMagnitude = resolveStatusMagnitudeFor(app!.magnitude, burn, app!, ember, hot)!;
  const coldMagnitude = resolveStatusMagnitudeFor(app!.magnitude, burn, app!, ember, cold)!;
  assert.ok(hotMagnitude > app!.magnitude!, 'a high-Intelligence caster does not exceed the base');
  assert.ok(coldMagnitude < app!.magnitude!, 'a low-Intelligence caster does not fall under the base');
});

test('status: a caster carrying no stats reads the authored base, never a scaled guess', () => {
  const setAlight = moves.setAlight;
  const app = statusApplicationsOf(setAlight).find((a) => a.statusId === 'Burn');
  assert.ok(app?.magnitude != null);
  // Types still count — STAB is knowable without a stat line — so this probes a non-Fire caster.
  assert.strictEqual(resolveStatusMagnitudeFor(app!.magnitude, statuses.Burn, app!, setAlight, { stats: {}, types: ['Stone'] }), app!.magnitude);
});
