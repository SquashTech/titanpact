// Automatic levelling and growth grades (docs/growth-overhaul.md §3). Every roster hero levels
// every won encounter, fielded or benched, and every level rolls each stat independently against
// that hero's authored grade for it. There is no pool, no allocation and no screen: Level is what
// a hero IS, and the only lane of growth the player never touches.
//
// Level is DERIVED from XP on a convex curve (docs/xp-overhaul.md §2): a won encounter pays the
// roster an AUTHORED amount of XP by act (ENCOUNTER_XP_BY_ACT), a level costs what the cube says,
// and the same XP is worth more levels to a hero below par than to one above it. Par is whatever
// that adds up to, and a bar part-way to the next level is the normal state, not an edge case.
//
// Roster-wide rather than participation-based (Fire Emblem's actual model) on purpose. Per-hero XP
// produces the runaway where your best four level, your sideboard rots, and by Act 4 you cannot
// rotate. This gets the screen removal without buying that problem — a hero rotated in is at
// parity, so rotating is free, which is BETTER for strategic churn than participation XP.

import type { GrowthStatKey, HeroDefinition, StatKey } from '../engine/content';
import type { MapNodeType } from './map';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

export const MAX_LEVEL = 30;

/** The stats a grade exists for: the seven the 550 budget covers. MP Regen is excluded, as it is from every other per-hero grant. */
export const GROWTH_STATS: readonly GrowthStatKey[] = [
  'hp',
  'attack',
  'defense',
  'intelligence',
  'wisdom',
  'speed',
  'manaPool',
];

export type GrowthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * What one level can do to one stat, per grade: the odds (in %) of gaining 0, 1, 2, 3 or 4
 * POINTS, indexed by the points. A grade is both how often a stat grows and how far it can jump —
 * an S rarely misses and reaches +4; an F almost always misses and never passes +2.
 *
 * Every row's mean is exactly `0.1 + 0.3 × GRADE_COST`, the figure the flat +2 roll paid, so the
 * grade budget still buys every on-budget line the same growth and the difficulty curve fitted
 * against the flat roll still holds. Only the shape changed: a level is a roll, not a schedule
 * (docs/growth-overhaul.md §3).
 */
export const GRADE_ROLL: Record<GrowthGrade, readonly number[]> = {
  S: [10, 24, 38, 22, 6],
  A: [18, 30, 30, 18, 4],
  B: [30, 28, 28, 10, 4],
  C: [40, 28, 24, 8],
  D: [52, 30, 14, 4],
  E: [68, 24, 8],
  F: [92, 6, 2],
};

/** Chance a level's roll for that stat lands at all — everything in the row past the miss. */
export const GRADE_CHANCE: Record<GrowthGrade, number> = Object.fromEntries(
  (Object.entries(GRADE_ROLL) as [GrowthGrade, readonly number[]][]).map(([grade, row]) => [grade, (100 - row[0]) / 100])
) as Record<GrowthGrade, number>;

/** Mean points a level pays that stat. Linear in cost — see GRADE_ROLL. */
export function gradeExpectedPoints(grade: GrowthGrade): number {
  return GRADE_ROLL[grade].reduce((sum, weight, points) => sum + (weight / 100) * points, 0);
}

/** The most points one level can land on a stat of that grade. */
export function gradeMaxPoints(grade: GrowthGrade): number {
  return GRADE_ROLL[grade].length - 1;
}

/**
 * What a grade costs against the grade budget. The SECOND budget: the 550 stat rule alone stops
 * being enough to say a hero is fairly costed the moment growth exists, because a low base with
 * S-grades outruns a high base with F-grades however the 550 is spent.
 */
export const GRADE_COST: Record<GrowthGrade, number> = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };

/** Every hero's grades sum to exactly this — seven stats at an average of B. */
export const GRADE_BUDGET = 28;

/**
 * What one POINT of a roll is worth on the stat line. HP is NOT a special case: CLAUDE.md's own
 * measured break-even is ≈0.33 a point, so 3 HP is 1 point's worth of anything else. Mana grows
 * 2 a point (2026-09-13, XP Overhaul phase 6): a Late move is priced in mana, and with the pool
 * at 1 a point a 50-pool hero could cast one once a fight at level 25. Player-only — an enemy
 * rolls no growth — and measured: Late casts 18 → 22% of Act 4, 29 → 34% of Act 5, 36 → 40% of
 * the finale, full-clear 57 → 59%.
 */
export const GROWTH_UNIT = 1;
export const GROWTH_UNIT_HP = 3;
export const GROWTH_UNIT_MANA = 2;

export function growthUnitFor(stat: StatKey): number {
  return stat === 'hp' ? GROWTH_UNIT_HP : stat === 'manaPool' ? GROWTH_UNIT_MANA : GROWTH_UNIT;
}

/** One stat's roll: the points the grade's row lands on, for one uniform draw. */
export function rollGradePoints(grade: GrowthGrade, random: () => number = Math.random): number {
  const row = GRADE_ROLL[grade];
  const draw = random();
  let cumulative = 0;
  for (let points = 0; points < row.length; points++) {
    cumulative += row[points];
    if (draw < cumulative / 100) return points;
  }
  return row.length - 1;
}

export type GrowthGrades = Record<GrowthStatKey, GrowthGrade>;

/**
 * The fallback for a hero with no authored line. Every one of the 36 authors its own as of
 * 2026-09-10 and test/roster.test.ts refuses a hero that does not, so this is reached only by a
 * hero definition mid-authoring. All-B is exactly the budget, so such a hero is fairly costed
 * rather than free.
 */
export const DEFAULT_GRADES: GrowthGrades = Object.fromEntries(
  GROWTH_STATS.map((stat) => [stat, 'B' as GrowthGrade])
) as GrowthGrades;

export function gradesFor(hero: HeroDefinition | undefined): GrowthGrades {
  return hero?.growthGrades ?? DEFAULT_GRADES;
}

export function gradeBudgetOf(grades: GrowthGrades): number {
  return GROWTH_STATS.reduce((total, stat) => total + GRADE_COST[grades[stat]], 0);
}

// --- The XP curve ---

/** Acts 1-5 each run three: the forced fight, the Elite-or-Skirmish, the Guardian (2026-09-14; the un-forked Skirmish came out to shorten the run). */
export const ENCOUNTERS_PER_ACT = 3;

/**
 * The cumulative XP to BE a level — Pokémon's Medium Fast, `L³`, 27,000 to the cap
 * (docs/xp-overhaul.md §2). Convex on purpose: a fixed grant is worth more levels to a hero
 * below par and fewer to one above it, which is what makes one encounter's XP both the catch-up
 * and the carry's throttle without a rule for either.
 */
export function xpForLevel(level: number): number {
  const at = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return at * at * at;
}

/** The bar's top: XP never accumulates past it. */
export const MAX_XP = xpForLevel(MAX_LEVEL);

/** The level `xp` has reached — the largest L in 1..MAX_LEVEL with `xpForLevel(L) ≤ xp`. */
export function levelForXp(xp: number): number {
  let level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Math.cbrt(Math.max(0, xp)))));
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return level;
}

/** A hero's level is read off its XP, never stored beside it: two figures for one fact drift. */
export function levelOf(entry: Pick<RosterEntry, 'xp'>): number {
  return levelForXp(entry.xp);
}

/** How far into its level `xp` sits, 0..1 — the bar. 1 at the cap: full, with nowhere to go. */
export function xpProgress(xp: number): number {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const floor = xpForLevel(level);
  return Math.max(0, Math.min(1, (xp - floor) / (xpForLevel(level + 1) - floor)));
}

/** XP still owed before the next level — 0 at the cap. */
export function xpToNextLevel(xp: number): number {
  const level = levelForXp(xp);
  return level >= MAX_LEVEL ? 0 : xpForLevel(level + 1) - xp;
}

/**
 * XP a won encounter pays every roster hero, by act — the AUTHORED object (2026-09-13, per user
 * direction, reversing docs/xp-overhaul.md §2's "derived from the level table"). A level table
 * paid out in XP sized to land a hero at par exactly ON a level filled the bar to the top every
 * fight, so XP was a number nobody ever saw and a level-up count with no rhyme to it. Now the
 * number is what a fight pays, a level costs what the cube says, and the bar lands wherever that
 * leaves it — sometimes part-way, which is how a player reads that a hero behind par is climbing
 * faster and that the next fight is worth more than the last. Par is DERIVED
 * (`levelAfterEncounters`) and no longer authored.
 *
 * Sized so par still reaches the decided act-end levels — 8 / 14 / 19 / 24 / 28 / 30 — which
 * `ENEMY_LEVEL_BY_ACT`, the Guild Hall's lag and the difficulty re-fit all read. Re-sized ×1.25 on
 * 2026-09-14 when the act went from four fights to three (two standard and the Guardian's double,
 * so an act pays four fights' worth where it paid five): the act-end levels are unchanged and
 * inside an act par walks 5/6/8, 10/11/14, 15/17/19, 20/21/24, 25/26/28. Index is the act,
 * 0-based; the last entry is the finale's one fight. First-pass playtest figures.
 */
export const ENCOUNTER_XP_BY_ACT: readonly number[] = [150, 560, 1060, 1750, 2000, 5000];

/**
 * What a fight's KIND pays over the act's base — the one place a node type prices its XP. The
 * Guardian is two fights' worth; the Elite (2026-09-14, per user direction) one and a half, so
 * the fork's harder tile pays in XP as well as in loot and the preview reads as a reason, not
 * only a risk. Par (below) assumes the Skirmish, so an Elite is XP ABOVE par — a player who takes
 * every Elite runs ~2,800 XP ahead over a run, a level by the end of act 5 and a fuller bar
 * throughout, never a whole act.
 */
export type EncounterXpKind = 'standard' | 'elite' | 'guardian';
export const ENCOUNTER_XP_MULTIPLIER: Record<EncounterXpKind, number> = { standard: 1, elite: 1.5, guardian: 2 };

/** The act's base fight, 1-based; the finale act reads its own entry. What the node dossier prices against. */
export function encounterXpForAct(actNumber: number): number {
  return ENCOUNTER_XP_BY_ACT[Math.max(1, Math.min(actNumber, ENCOUNTER_XP_BY_ACT.length)) - 1];
}

/** The kind a map node pays as. The finale is its own base figure, not a Guardian. */
export function encounterXpKind(nodeType: MapNodeType): EncounterXpKind {
  return nodeType === 'boss' ? 'guardian' : nodeType === 'elite' ? 'elite' : 'standard';
}

/** Won encounters in a full clear: three an act for acts 1-5, then the finale's one fight. Nothing past it pays. */
export const TOTAL_ENCOUNTERS = ENCOUNTERS_PER_ACT * (ENCOUNTER_XP_BY_ACT.length - 1) + 1;

/**
 * The kind par assumes for the Nth won encounter: the map guarantees three an act with the
 * Guardian last, and the fork is taken as its Skirmish — the floor, so that the Elite's bonus
 * is above par rather than baked into it.
 */
export function encounterXpKindAtPar(encountersWon: number): EncounterXpKind {
  const act = Math.floor((encountersWon - 1) / ENCOUNTERS_PER_ACT);
  const guardian = act < ENCOUNTER_XP_BY_ACT.length - 1 && encountersWon % ENCOUNTERS_PER_ACT === 0;
  return guardian ? 'guardian' : 'standard';
}

/**
 * XP the Nth won encounter of a run pays every roster hero (1-based): the act's base, read off
 * the count, times the kind's multiplier, read off the node that was fought (par's kind when no
 * node is named). Known before the fight rather than rolled after it. A DELTA, never a target —
 * a hero that joined late missed the grants before it and is behind — but the same XP climbs
 * further from lower down the cube, so the gap closes slowly on its own.
 */
export function xpForEncounter(encountersWon: number, kind: EncounterXpKind = encounterXpKindAtPar(encountersWon)): number {
  if (encountersWon < 1 || encountersWon > TOTAL_ENCOUNTERS) return 0;
  const act = Math.floor((encountersWon - 1) / ENCOUNTERS_PER_ACT);
  return Math.round(encounterXpForAct(act + 1) * ENCOUNTER_XP_MULTIPLIER[kind]);
}

/** Par, in XP: what a hero that never missed a win holds after `encountersWon`. */
export function xpAfterEncounters(encountersWon: number): number {
  let xp = xpForLevel(1);
  for (let n = 1; n <= Math.min(encountersWon, TOTAL_ENCOUNTERS); n++) xp += xpForEncounter(n);
  return Math.min(MAX_XP, xp);
}

/** Par, in levels — DERIVED from the XP table, never authored beside it. */
export function levelAfterEncounters(encountersWon: number): number {
  return levelForXp(xpAfterEncounters(encountersWon));
}

/** Par after each encounter, index = encounters won. Derived; here so the tests and the docs can read the walk at a glance. */
export const LEVEL_AFTER_ENCOUNTER: readonly number[] = Array.from({ length: TOTAL_ENCOUNTERS + 1 }, (_, n) => levelAfterEncounters(n));

// --- The roll ---

/** One level's worth of growth for one hero: each stat rolled independently against its grade. */
export function rollLevelGrowth(
  grades: GrowthGrades,
  random: () => number = Math.random
): Partial<Record<StatKey, number>> {
  const gained: Partial<Record<StatKey, number>> = {};
  for (const stat of GROWTH_STATS) {
    const points = rollGradePoints(grades[stat], random);
    if (points > 0) gained[stat] = points * growthUnitFor(stat);
  }
  return gained;
}

/**
 * `xp` onto one hero, capped at MAX_XP, rolling growth for every level the grant crosses. Returns
 * the entry and what it gained, so a caller can report it without re-deriving.
 */
export function grantXp(
  entry: RosterEntry,
  hero: HeroDefinition | undefined,
  xp: number,
  random: () => number = Math.random
): { entry: RosterEntry; gained: Partial<Record<StatKey, number>> } {
  const grades = gradesFor(hero);
  const next = Math.min(MAX_XP, entry.xp + Math.max(0, xp));
  const target = levelForXp(next);
  let gained: Partial<Record<StatKey, number>> = {};
  for (let level = levelOf(entry); level < target; level++) {
    gained = mergeStatMods(gained, rollLevelGrowth(grades, random));
  }
  return {
    entry: { ...entry, xp: next, growthStatGrants: mergeStatMods(entry.growthStatGrants, gained) },
    gained,
  };
}

/**
 * `levels` whole levels onto one hero — what a generated hero takes on arrival (a Guild hire, the
 * companion), landing it exactly ON a level rather than part-way to the next.
 */
export function levelUpEntry(
  entry: RosterEntry,
  hero: HeroDefinition | undefined,
  levels: number,
  random: () => number = Math.random
): { entry: RosterEntry; gained: Partial<Record<StatKey, number>> } {
  const target = Math.min(MAX_LEVEL, levelOf(entry) + Math.max(0, levels));
  return grantXp(entry, hero, xpForLevel(target) - entry.xp, random);
}

/**
 * What one won encounter did to ONE hero. The roll is destructive — a grade is a coin, not a
 * schedule — so what it produced has to be carried out of the grant rather than read back off the
 * entry afterwards. The post-battle screen is the only reader.
 */
export interface HeroLevelUp {
  rosterId: string;
  heroId: string;
  fromLevel: number;
  /** Equal to `fromLevel` for a hero already at MAX_LEVEL; it is still on the roster and still reported. */
  toLevel: number;
  /** The bar's two ends: where the XP stood and where the grant left it. Capped at MAX_XP, so a hero at the cap gains none. */
  fromXp: number;
  toXp: number;
  gained: Partial<Record<StatKey, number>>;
}

/**
 * What one won encounter does to the whole roster — benched heroes included, which is the point —
 * and the per-hero report of what it rolled.
 */
export function applyEncounterLevels(
  run: RunState,
  heroLookup: Record<string, HeroDefinition>,
  random: () => number = Math.random,
  /** What was fought — the Elite and the Guardian pay more than the count alone says. */
  kind: EncounterXpKind = encounterXpKindAtPar(run.encountersWon)
): { run: RunState; report: HeroLevelUp[] } {
  const xp = xpForEncounter(run.encountersWon, kind);
  if (xp <= 0) return { run, report: [] };
  const report: HeroLevelUp[] = [];
  const roster = run.roster.map((entry) => {
    const { entry: levelled, gained } = grantXp(entry, heroLookup[entry.heroId], xp, random);
    report.push({
      rosterId: entry.rosterId,
      heroId: entry.heroId,
      fromLevel: levelOf(entry),
      toLevel: levelOf(levelled),
      fromXp: entry.xp,
      toXp: levelled.xp,
      gained,
    });
    return levelled;
  });
  return { run: { ...run, roster }, report };
}

/** The same grant, for a caller with nowhere to report it (the simulator, the tests). */
export function grantEncounterLevels(
  run: RunState,
  heroLookup: Record<string, HeroDefinition>,
  random: () => number = Math.random,
  kind: EncounterXpKind = encounterXpKindAtPar(run.encountersWon)
): RunState {
  return applyEncounterLevels(run, heroLookup, random, kind).run;
}
