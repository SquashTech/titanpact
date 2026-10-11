// The companion (docs/companion-call.md): one of the two Early spawn the player beats in the run's
// first fight asks to join, and it does — there is no declining (per user direction). It is a summon,
// not a party member: it takes no roster slot, levels with nobody, holds nothing, and cannot be
// lost. Once a fight it acts on its own, casting its tier's one move from off the field in a round
// rolled inside its line's window (§12) and telegraphed from the top of that round. Its tier follows
// the act (SPAWN_TIER_BY_ACT), and its stats are its line's at the run's par on the expected line,
// so its move scales with the run without the companion levelling.

import type { TypeId } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import type { Encounter } from './enemyGen';
import type { CallPlacement } from './buildCombatState';
import { spawnId, spawnLineOf, spawnPosition, type CallTiming, type SpawnTier } from '../data/titanspawn';
import { MAX_LEVEL, expectedGrowthAt, levelAfterEncounters, xpForLevel } from './growth';
import { SPAWN_TIER_BY_ACT } from './difficulty';
import { GATHERING_COMPANION_LEVEL_BONUS, isGathering } from './cycles';
import { FINALE_ACT, createRosterEntry, type RunState } from './state';

/** The companion a run took: its line, and whether it has woken to Ancient (this run, or its line on an earlier one). */
export interface CompanionState {
  type: TypeId;
  ascended: boolean;
}

/** The roster id the Called caster is placed under — never a real roster entry's. */
export const COMPANION_ROSTER_ID = 'companion';

/** The type the companion wakes to: the Titan's own, in the secondary slot a hero's graft would fill. */
export const ANCIENT: TypeId = 'Ancient';

/** True once, on the run's first fight: a `fight` node, and no companion ever taken. */
export function companionJoinDue(run: RunState, mapNodeType: string): boolean {
  return mapNodeType === 'fight' && run.fightsStarted === 1 && run.companion === null;
}

/** The body that asks: the beaten side's lead, if it is an Early spawn — which the first fight's always are. */
export function companionCandidate(encounter: Encounter): string | null {
  const order = [...encounter.squad.activeIds.filter((id): id is string => id !== null), ...encounter.squad.benchIds];
  for (const rosterId of order) {
    const entry = encounter.run.roster.find((r) => r.rosterId === rosterId);
    const position = entry && spawnPosition(entry.heroId);
    if (position?.tier === 'early') return entry!.heroId;
  }
  return null;
}

/** It joins as its line. `ascended`: its line woke on an earlier run (profile.ts `ascendedSpawnTypes`). */
export function joinCompanion(run: RunState, heroId: string, ascended = false): RunState {
  const position = spawnPosition(heroId);
  if (!position) throw new Error(`${heroId} is not a spawn and cannot be the companion`);
  return { ...run, companion: { type: position.line.type, ascended } };
}

const NEXT_TIER: Record<SpawnTier, SpawnTier> = { early: 'mid', mid: 'late', late: 'late' };

/**
 * The tier the companion stands at in an act — the escorts' own schedule, a tier ahead of it in a
 * Gathering (docs/cycles.md §3), where the survivors have trained it.
 */
export function companionTier(actNumber: number, cycle = 1): SpawnTier {
  const tier = SPAWN_TIER_BY_ACT[Math.min(Math.max(actNumber, 1), SPAWN_TIER_BY_ACT.length) - 1];
  return isGathering({ cycle }) ? NEXT_TIER[tier] : tier;
}

/** The body the run's companion stands in this act, or null without one. */
export function companionHeroId(run: Pick<RunState, 'companion' | 'actNumber' | 'cycle'>): string | null {
  const line = run.companion && spawnLineOf(run.companion.type);
  return line ? spawnId(line, companionTier(run.actNumber, run.cycle)) : null;
}

/** The one move the companion casts this act, or null without one. */
export function companionCallMoveId(run: Pick<RunState, 'companion' | 'actNumber' | 'cycle'>): string | null {
  const line = run.companion && spawnLineOf(run.companion.type);
  return line ? line.callMoveIds[companionTier(run.actNumber, run.cycle)] : null;
}

/**
 * The rounds into a fight (or a phase) a line's companion acts in, inclusive (docs/companion-call.md
 * §12.2): the opening two, or the third to the fifth. First pass, for playtest.
 */
export const CALL_WINDOWS: Record<CallTiming, readonly [number, number]> = {
  early: [1, 2],
  mid: [3, 5],
};

/** Woken and in the finale: it acts once in each phase, and its move resolves as Ancient (§12.4). */
export function companionAwakenedFor(run: Pick<RunState, 'companion' | 'actNumber'>): boolean {
  return !!run.companion?.ascended && run.actNumber === FINALE_ACT;
}

/**
 * The companion a fight seats (docs/companion-call.md §12): the act's body at the run's par, every
 * level at its grade's mean so the figure is the same every fight of a stretch — no gear, no
 * Banners, nothing the roster carries. It acts once, in a round rolled inside its line's window;
 * woken, in the finale, once in each phase and as Ancient.
 */
export function companionCallFor(run: RunState, heroes: HeroLookup): CallPlacement | null {
  const heroId = companionHeroId(run);
  const moveId = companionCallMoveId(run);
  const hero = heroId ? heroes[heroId] : undefined;
  const line = run.companion && spawnLineOf(run.companion.type);
  if (!heroId || !moveId || !hero || !line) return null;
  const level = Math.min(MAX_LEVEL, levelAfterEncounters(run.encountersWon) + (isGathering(run) ? GATHERING_COMPANION_LEVEL_BONUS : 0));
  const entry = {
    ...createRosterEntry(COMPANION_ROSTER_ID, heroId, [moveId]),
    xp: xpForLevel(level),
    growthStatGrants: expectedGrowthAt(hero, level),
    evolutionTypeGraft: run.companion!.ascended ? ANCIENT : null,
  };
  const awakened = companionAwakenedFor(run);
  return { entry, moveId, window: CALL_WINDOWS[line.callTiming], ...(awakened ? { perPhase: true, moveType: ANCIENT } : {}) };
}

/** The companion as the finale opens, when it has not yet woken — the one the awakening beat is for. */
export function companionToAwaken(run: RunState): CompanionState | null {
  return run.companion && !run.companion.ascended ? run.companion : null;
}

/** The companion reaches its true potential: Ancient takes its secondary slot, and in the finale it acts as Ancient once in each phase. */
export function awakenCompanion(run: RunState): RunState {
  return companionToAwaken(run) ? { ...run, companion: { ...run.companion!, ascended: true } } : run;
}

/**
 * The step an act boundary takes the companion through, when the tier changes — the `grown` beat's
 * two bodies. Null when it does not, or there is no companion.
 */
export function companionGrowth(run: Pick<RunState, 'companion' | 'cycle'>, fromAct: number, toAct: number): { fromHeroId: string; toHeroId: string } | null {
  const line = run.companion && spawnLineOf(run.companion.type);
  if (!line) return null;
  const from = companionTier(fromAct, run.cycle);
  const to = companionTier(toAct, run.cycle);
  return from === to ? null : { fromHeroId: spawnId(line, from), toHeroId: spawnId(line, to) };
}

/**
 * The companion's beats (docs/companion-call.md §8): `join` — the run's first fight is won and one
 * of the Earlies asks to come along; there is no declining, so the one button is a welcome. `grown`
 * — the act boundary steps its tier, the same creature in its next body with its next move.
 */
export type CompanionBeat =
  | { kind: 'join'; heroId: string }
  | { kind: 'grown'; fromHeroId: string; toHeroId: string };
