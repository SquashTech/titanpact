// Where a saved run resumes (docs/save-system.md §4): the screen it was written on, and for a fight
// the board mid-way. Pure, so the node tests reach it; App owns the screen machine itself.
//
// A screen that grants once (a Boon, a Banner, an item given) marks itself `settled` the moment its
// grant reaches the run. A resume onto a settled screen goes past it (`resumeTarget`), since the
// screen's own record of having granted died with the page and it would offer the grant again.

import type { CombatState, Side } from '../engine/state';
import type { ConsumableKind, ConsumablePurse } from './consumables';
import { CONSUMABLE_KINDS } from './consumables';
import type { Encounter, EncounterNodeType } from './enemyGen';
import type { GauntletResult } from './gauntlet';
import type { HeroLevelUp } from './growth';
import type { CompanionBeat } from './companion';
import type { RewardNodeType } from './map';
import { GEM_ORDER, rollGems, rollShelfGems, type Gem, type GemPlan } from './gems';
import type { GrowthStatKey } from '../engine/content';
import type { MvpLedger, MvpTally } from './mvp';
import type { GuildHallOffer, RosterReplaceCandidate } from './recruitment';
import type { GuildHallOffers } from './shop';
import type { Squad } from './squad';
import type { RosterEntry, RunState } from './state';
import { createRunState } from './state';
import { advanceToNode } from './runProgress';
import { combatantIdFor } from './combatantIds';
import {
  Rejected,
  decodeConsumables,
  decodeRosterEntry,
  isInt,
  isObject,
  isStringArray,
  reject,
  type SaveContentIndex,
} from './save';

export type RunScreen =
  | { kind: 'title' }
  /** The lore card, ahead of the first draft on an account (docs/tutorial.md). */
  | { kind: 'lore'; next: RunScreen; lines: readonly string[]; tipId: string }
  | { kind: 'draft'; optionIds: string[] }
  /** Permadeath's post-fight beat (docs/ascension.md §3): the KO'd heroes, still on the roster until Continue. */
  | { kind: 'fallen'; rosterIds: string[]; next: RunScreen }
  /** The act-boundary beat: five sockets, one per Guardian (docs/run-loop.md §4). */
  | { kind: 'pactSeal' }
  /** Acts 2-5 open on a 1-of-2 (docs/locations.md §1): the offer is drawn once, when the seal is behind the player. */
  | { kind: 'locationChoice'; candidateIds: string[] }
  /** Per-act arrival beat; reads its location off the run's itinerary. */
  | { kind: 'blessing' }
  | { kind: 'actIntro' }
  /** The Herald announced before its fight; `next` is the fight. */
  | { kind: 'herald'; next: RunScreen }
  /** The companion, brought to the finale, wakes to Ancient; `next` is the fight. */
  | { kind: 'companionAwakens'; heroId: string; next: RunScreen }
  /** The Eyes have closed: the collapse and the re-binding, ahead of everything the fight pays. */
  | { kind: 'titanBound'; next: RunScreen }
  | { kind: 'map' }
  | {
      kind: 'fight';
      nodeId: string;
      nodeType: EncounterNodeType;
      squad: Squad;
      encounter: Encounter;
      goldReward: number;
      xpGained: number;
      /** Rolled at fight entry so the victory screen can spotlight it; handleFightResolved reuses it. */
      equipmentRewardId: string | null;
      /** The potion drop, rolled and carried the same way. */
      consumableReward: ConsumableKind | null;
      /** The Elite's Recruit Contract drop (run/recruitment.ts rollContractDrop). */
      contractReward: boolean;
      /** The fight's Gem drop (run/gems.ts rollGemDrop), placed after the item's who-screen. */
      gemReward: Gem[];
      /** Seeds the level roll, so the victory screen shows the growth handleFightResolved will land (run/growth.ts previewLevelUp). */
      levelSeed: number;
    }
  | { kind: 'quickBattle'; player: Encounter; ai: Encounter }
  | { kind: 'sandboxBattle' }
  | { kind: 'sandboxFight'; player: Encounter; ai: Encounter; playerRelics: string[] }
  /** TEMPORARY DEV/TEST — the Trials before the teambuilder (docs/constructed.md §11 step 6). */
  | { kind: 'trialsDev' }
  | { kind: 'trialsFight'; player: Encounter; ai: Encounter }
  /** The teambuilder (docs/constructed.md §9). `unlockAll` is the dev route's every-hero gate. */
  | { kind: 'constructed'; startTeam?: number | null; unlockAll?: boolean; notice?: string | null }
  /** `locationId`: where the fight stands, for backdrop and music (run/locations.ts arenaLocationIds); the two modes borrow a run's places. */
  | { kind: 'constructedFight'; player: Encounter; ai: Encounter; teamIndex: number; trialId: string; unlockAll?: boolean; locationId?: string | null }
  /** The Gauntlet (docs/gauntlet.md). Its run lives on the profile; `result` is a run that just ended, said once. */
  | { kind: 'gauntlet'; result?: GauntletResult | null; notice?: string | null }
  /** `aiPilot`: run/pilot.ts flies the opponent (run/gauntlet.ts gauntletAiPilot), else Classic's AI. */
  | { kind: 'gauntletFight'; player: Encounter; ai: Encounter; locationId?: string | null; aiPilot: boolean }
  /** TEMPORARY DEV/TEST — src/run/statusTestFight.ts. Own kind so leaving returns to the title. */
  | { kind: 'statusTestFight'; player: Encounter; ai: Encounter }
  /** `offers` lives on the screen, not in the shop component: a purchase re-renders the shop and component-local state would reroll / forget. */
  | { kind: 'shop'; nodeId: string; offers: GuildHallOffers; gemsBought: number[]; rerolls: number; itemsBought: number[] }
  /** `seed` fixes what the chest holds, so a reload opens the same one. */
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType; seed: number; settled?: boolean }
  /** An item has arrived and asks who carries it (docs/gear-absorption.md §2). `next` is where the run goes once it is absorbed or sold. */
  | { kind: 'itemWho'; itemId: string; next: RunScreen; settled?: boolean }
  | { kind: 'manaWell'; nodeId: string; settled?: boolean }
  | { kind: 'blessingShrine'; nodeId: string; settled?: boolean }
  | { kind: 'forge'; nodeId: string; settled?: boolean }
  | { kind: 'leyLine'; nodeId: string; settled?: boolean }
  | { kind: 'rest'; nodeId: string; settled?: boolean }
  /**
   * Gems to whoever the player taps (run/gems.ts, docs/gems.md): the Scribe's
   * forced row, the Gem Cache's reward seat, and the Guild Hall shelf (`bought`, `nodeId` null,
   * the gold already charged). `progress` is the pips still to land and the heroes already paid,
   * kept here so a reload neither repays nor forgets them.
   */
  | { kind: 'scrolls'; plan: GemPlan; nodeId: string | null; bought: boolean; next: RunScreen; progress?: ScrollProgress }
  | { kind: 'boonNode'; nodeId: string; seed: number; settled?: boolean }
  /** The Mentor (acts 1-3): pick a hero, and one Mid move is rolled for it. */
  | { kind: 'mentorNode'; nodeId: string; seed: number; settled?: boolean }
  /** The Tutor (acts 4-5): pick a hero, and one Late move is rolled for it. */
  | { kind: 'tutorNode'; nodeId: string; seed: number; settled?: boolean }
  /** Which event this node is gets rolled ONCE at node-select time; `seed` fixes what its options hold. */
  | { kind: 'event'; nodeId: string; eventId: string; seed: number; settled?: boolean }
  /** What the fight just did to the roster. `taken` is who has already taken a schedule entry this report. */
  | { kind: 'levelUp'; report: readonly HeroLevelUp[]; next: RunScreen; seed: number; taken?: string[] }
  /** The companion's beats (run/companion.ts): the join after the level report; the tier-step at the act boundary, before the seal. */
  | { kind: 'companion'; beat: CompanionBeat; next: RunScreen }
  /** Guardian's Banner after a Guardian win. Not a map node, so no nodeId. */
  | { kind: 'guardianBanner'; next: RunScreen; settled?: boolean }
  /** The Crucible: pick one hero, and that hero takes a Class. The Guardian's beat. */
  | { kind: 'crucible'; next: RunScreen; seed: number; settled?: boolean }
  /** Roster-full replacement, Guild Hall path only; the contract path resolves in RecruitScreen. */
  | { kind: 'rosterReplace'; candidate: RosterReplaceCandidate; next: RunScreen }
  /** Offers sampled once in handleFightResolved; only pushed when the player holds a contract. */
  | { kind: 'recruit'; offers: RosterEntry[]; next: RunScreen; claimedRosterIds?: string[] }
  /** The Eyes have closed: the roster presented as the heroes of the land, then the summary. */
  | { kind: 'champions' }
  | { kind: 'runComplete' }
  | { kind: 'runFailed' };

export type RunScreenKind = RunScreen['kind'];

export interface ScrollProgress {
  remaining: number;
  pickedIds: string[];
}

/** What a fight needs to carry on from a command phase. Everything else on the board is playback. */
export interface CombatSnapshot {
  state: CombatState;
  usedConsumables: ConsumablePurse;
  leadsPending: boolean;
  mvpTally: MvpTally;
}

export interface ResumePayload {
  screen: RunScreen;
  /** Present when `screen` is a fight saved at a command phase. */
  combat?: CombatSnapshot;
  /** Across an act break the ambient place is still the act just cleared (App's actBreak). */
  actBreak?: boolean;
}

/** The screens a run is saved on. The title, the run's end, and anything outside a run are not. */
const RESUMABLE: ReadonlySet<RunScreenKind> = new Set<RunScreenKind>([
  'fallen',
  'pactSeal',
  'locationChoice',
  'blessing',
  'actIntro',
  'herald',
  'companionAwakens',
  'titanBound',
  'map',
  'fight',
  'shop',
  'reward',
  'itemWho',
  'manaWell',
  'blessingShrine',
  'forge',
  'leyLine',
  'rest',
  'scrolls',
  'boonNode',
  'mentorNode',
  'tutorNode',
  'event',
  'levelUp',
  'companion',
  'guardianBanner',
  'crucible',
  'rosterReplace',
  'recruit',
  'champions',
]);

export function isResumable(kind: RunScreenKind): boolean {
  return RESUMABLE.has(kind);
}

/** A depth past this is a corrupt file, not a post-fight chain: the longest real one is under ten. */
const MAX_CHAIN_DEPTH = 24;

/**
 * Where a resumed screen actually opens, and the run it opens on. A settled screen is skipped: a
 * node's walks the node, a chain link's opens what follows it.
 */
export function resumeTarget(screen: RunScreen, run: RunState): { screen: RunScreen; run: RunState } {
  let cursor = screen;
  let current = run;
  for (let depth = 0; depth < MAX_CHAIN_DEPTH && 'settled' in cursor && cursor.settled; depth++) {
    if ('nodeId' in cursor && typeof cursor.nodeId === 'string') {
      return { screen: { kind: 'map' }, run: advanceToNode(current, cursor.nodeId) };
    }
    if ('next' in cursor) cursor = cursor.next;
    else break;
  }
  return { screen: cursor, run: current };
}

// --- Encoding ---

/** Plain data already; the encode is the identity, named so the write site reads as one. */
export function encodeResume(payload: ResumePayload): ResumePayload {
  return payload;
}

// --- Decoding ---

interface Ctx {
  index: SaveContentIndex;
  /** The same index with every fieldable body as a hero: an enemy party, a contract offer. */
  enemyIndex: SaveContentIndex;
  run: RunState;
}

function str(value: unknown, label: string): string {
  if (typeof value !== 'string') reject(`${label} is not a string`);
  return value;
}

function int(value: unknown, label: string, min = 0): number {
  if (!isInt(value, min)) reject(`${label} is not a count`);
  return value;
}

function bool(value: unknown): boolean {
  return value === true;
}

function nodeId(value: unknown, ctx: Ctx, label: string): string {
  const id = str(value, label);
  if (!ctx.run.map?.nodes[id]) reject(`${label} names missing node "${id}"`);
  return id;
}

function rosterIds(value: unknown, ctx: Ctx, label: string): string[] {
  if (!isStringArray(value)) reject(`${label} is not a list of ids`);
  const known = new Set(ctx.run.roster.map((entry) => entry.rosterId));
  for (const id of value) if (!known.has(id)) reject(`${label} names "${id}", not on the roster`);
  return [...value];
}

function itemId(value: unknown, ctx: Ctx, label: string): string {
  const id = str(value, label);
  if (!ctx.index.equipmentIds.has(id)) reject(`${label} references unknown equipment "${id}"`);
  return id;
}

function heroId(value: unknown, ctx: Ctx, label: string): string {
  const id = str(value, label);
  if (!ctx.index.combatantIds.has(id)) reject(`${label} references unknown hero "${id}"`);
  return id;
}

function settled(raw: Record<string, unknown>): { settled?: true } {
  return raw.settled === true ? { settled: true } : {};
}

function decodeSquad(value: unknown, label: string): Squad {
  if (!isObject(value)) reject(`${label} is not an object`);
  const active = value.activeIds;
  if (!Array.isArray(active) || active.length !== 2 || !active.every((id) => id === null || typeof id === 'string')) {
    reject(`${label}.activeIds is not two slots`);
  }
  if (!isStringArray(value.benchIds)) reject(`${label}.benchIds is not a list of ids`);
  const squad: Squad = { activeIds: [active[0] as string | null, active[1] as string | null], benchIds: [...value.benchIds] };
  if (value.reserves !== undefined) {
    if (!Array.isArray(value.reserves) || !value.reserves.every(isStringArray)) reject(`${label}.reserves is not a list of phases`);
    squad.reserves = (value.reserves as string[][]).map((phase) => [...phase]);
  }
  if (value.downIds !== undefined) {
    if (!isStringArray(value.downIds)) reject(`${label}.downIds is not a list of ids`);
    squad.downIds = [...value.downIds];
  }
  return squad;
}

function decodeEncounter(value: unknown, ctx: Ctx, label: string): Encounter {
  if (!isObject(value) || !isObject(value.run) || !Array.isArray(value.run.roster)) reject(`${label} has no party`);
  const roster = value.run.roster.map((entry, at) => decodeRosterEntry(entry, ctx.enemyIndex, `${label}.roster[${at}]`));
  const squad = decodeSquad(value.squad, `${label}.squad`);
  const ids = new Set(roster.map((entry) => entry.rosterId));
  const placed = [...squad.activeIds.filter((id): id is string => id !== null), ...squad.benchIds, ...(squad.reserves ?? []).flat()];
  for (const id of placed) if (!ids.has(id)) reject(`${label}.squad names "${id}", not in its party`);
  return { run: { ...createRunState(0), roster }, squad };
}

function decodeLevelUps(value: unknown, ctx: Ctx): HeroLevelUp[] {
  if (!Array.isArray(value)) reject('levelUp.report is not a list');
  return value.map((row, at) => {
    const label = `levelUp.report[${at}]`;
    if (!isObject(row)) reject(`${label} is not an object`);
    const gained: Partial<Record<string, number>> = {};
    if (!isObject(row.gained)) reject(`${label}.gained is not a stat map`);
    for (const [key, amount] of Object.entries(row.gained)) gained[key] = int(amount, `${label}.gained.${key}`);
    return {
      rosterId: str(row.rosterId, `${label}.rosterId`),
      heroId: heroId(row.heroId, ctx, `${label}.heroId`),
      fromLevel: int(row.fromLevel, `${label}.fromLevel`, 1),
      toLevel: int(row.toLevel, `${label}.toLevel`, 1),
      fromXp: int(row.fromXp, `${label}.fromXp`),
      toXp: int(row.toXp, `${label}.toXp`),
      gained: gained as HeroLevelUp['gained'],
    };
  });
}

function decodeGuildOffer(value: unknown, ctx: Ctx, label: string): GuildHallOffer {
  if (!isObject(value)) reject(`${label} is not an object`);
  if (!isStringArray(value.startingMoveIds)) reject(`${label}.startingMoveIds is not a list`);
  for (const id of value.startingMoveIds) if (!ctx.index.moveIds.has(id)) reject(`${label} references unknown move "${id}"`);
  return {
    id: str(value.id, `${label}.id`),
    heroId: heroId(value.heroId, ctx, `${label}.heroId`),
    startingMoveIds: [...value.startingMoveIds],
  };
}

function decodeCandidate(value: unknown, ctx: Ctx): RosterReplaceCandidate {
  if (!isObject(value)) reject('rosterReplace.candidate is not an object');
  if (value.source === 'guildHall') return { source: 'guildHall', offer: decodeGuildOffer(value.offer, ctx, 'rosterReplace.offer') };
  if (value.source === 'contract' && isObject(value.offer)) {
    const { rosterId: _drop, ...offer } = decodeRosterEntry({ ...value.offer, rosterId: 'offer' }, ctx.enemyIndex, 'rosterReplace.offer');
    return { source: 'contract', offer };
  }
  reject('rosterReplace.candidate has an unknown source');
}

function decodeBeat(value: unknown, ctx: Ctx): CompanionBeat {
  if (!isObject(value)) reject('companion.beat is not an object');
  if (value.kind === 'join') return { kind: 'join', heroId: heroId(value.heroId, ctx, 'companion.beat.heroId') };
  if (value.kind === 'grown') {
    return { kind: 'grown', fromHeroId: heroId(value.fromHeroId, ctx, 'companion.beat.fromHeroId'), toHeroId: heroId(value.toHeroId, ctx, 'companion.beat.toHeroId') };
  }
  reject('companion.beat has an unknown kind');
}

function decodeGems(value: unknown, label: string): Gem[] {
  if (!Array.isArray(value)) reject(`${label} is not a list of Gems`);
  return value.map((gem, i) =>
    isObject(gem) && GEM_ORDER.includes(gem.stat as GrowthStatKey) && typeof gem.points === 'number'
      ? { stat: gem.stat as GrowthStatKey, points: gem.points }
      : reject(`${label}[${i}] is not a Gem`)
  );
}

function decodePlan(value: unknown, ctx: Ctx): GemPlan {
  if (isObject(value) && (value.source === 'scribe' || value.source === 'cache' || value.source === 'shelf' || value.source === 'drop') && Array.isArray(value.gems)) {
    return { source: value.source, gems: decodeGems(value.gems, 'scrolls.plan.gems') };
  }
  // A screen saved before Gems: its Scrolls arrive as Gems, rolled now.
  if (isObject(value) && value.kind === 'scribe') return { source: 'scribe', gems: rollGems(4, ctx.run.actNumber) };
  if (isObject(value) && value.kind === 'scrolls') return { source: 'cache', gems: rollGems(int(value.count, 'scrolls.plan.count', 1), ctx.run.actNumber) };
  reject('scrolls.plan is unknown');
}

const NODE_SCREENS = ['manaWell', 'blessingShrine', 'forge', 'leyLine', 'rest'] as const;
const SEEDED_NODE_SCREENS = ['boonNode', 'mentorNode', 'tutorNode'] as const;
const PASS_THROUGH = ['pactSeal', 'blessing', 'actIntro', 'map', 'champions'] as const;

function decodeScreen(value: unknown, ctx: Ctx, depth: number): RunScreen {
  if (depth > MAX_CHAIN_DEPTH) reject('the screen chain is too deep');
  if (!isObject(value) || typeof value.kind !== 'string') reject('screen has no kind');
  const raw = value;
  // A run saved on the old cold open (deleted 2026-10-06, its eyes now on the lore cards) picks up on the screen it led to.
  if (raw.kind === 'titanWake') return { kind: 'blessing' };
  const kind = raw.kind as RunScreenKind;
  if (!isResumable(kind)) reject(`screen "${kind}" is not one a run is saved on`);
  const next = () => decodeScreen(raw.next, ctx, depth + 1);

  if ((PASS_THROUGH as readonly string[]).includes(kind)) return { kind } as RunScreen;
  if ((NODE_SCREENS as readonly string[]).includes(kind)) {
    return { kind, nodeId: nodeId(raw.nodeId, ctx, `${kind}.nodeId`), ...settled(raw) } as RunScreen;
  }
  if ((SEEDED_NODE_SCREENS as readonly string[]).includes(kind)) {
    return { kind, nodeId: nodeId(raw.nodeId, ctx, `${kind}.nodeId`), seed: int(raw.seed, `${kind}.seed`), ...settled(raw) } as RunScreen;
  }

  switch (kind) {
    case 'fallen':
      return {
        kind,
        rosterIds: rosterIds(raw.rosterIds, ctx, 'fallen.rosterIds'),
        next: next(),
      };
    case 'locationChoice': {
      if (!isStringArray(raw.candidateIds) || raw.candidateIds.length === 0) reject('locationChoice.candidateIds is empty');
      for (const id of raw.candidateIds) if (!ctx.index.locationIds.has(id)) reject(`locationChoice references unknown location "${id}"`);
      return { kind, candidateIds: [...raw.candidateIds] };
    }
    case 'herald':
    case 'titanBound':
      return { kind, next: next() };
    case 'companionAwakens':
      return { kind, heroId: heroId(raw.heroId, ctx, 'companionAwakens.heroId'), next: next() };
    case 'fight': {
      if (raw.nodeType !== 'fight' && raw.nodeType !== 'elite' && raw.nodeType !== 'boss') reject('fight.nodeType is unknown');
      const reward = raw.equipmentRewardId === null || raw.equipmentRewardId === undefined ? null : itemId(raw.equipmentRewardId, ctx, 'fight.equipmentRewardId');
      const drop = raw.consumableReward ?? null;
      if (drop !== null && !CONSUMABLE_KINDS.includes(drop as ConsumableKind)) reject('fight.consumableReward is unknown');
      const squad = decodeSquad(raw.squad, 'fight.squad');
      const roster = new Set(ctx.run.roster.map((entry) => entry.rosterId));
      for (const id of [...squad.activeIds, ...squad.benchIds, ...(squad.downIds ?? [])]) {
        if (id !== null && !roster.has(id)) reject(`fight.squad names "${id}", not on the roster`);
      }
      return {
        kind,
        nodeId: nodeId(raw.nodeId, ctx, 'fight.nodeId'),
        nodeType: raw.nodeType,
        squad,
        encounter: decodeEncounter(raw.encounter, ctx, 'fight.encounter'),
        goldReward: int(raw.goldReward, 'fight.goldReward'),
        xpGained: int(raw.xpGained, 'fight.xpGained'),
        equipmentRewardId: reward,
        consumableReward: drop as ConsumableKind | null,
        // Absent on a fight saved before the Elite dropped contracts.
        contractReward: raw.contractReward === true,
        // Absent on a fight saved before fights dropped Gems.
        gemReward: raw.gemReward === undefined ? [] : decodeGems(raw.gemReward, 'fight.gemReward'),
        levelSeed: int(raw.levelSeed, 'fight.levelSeed'),
      };
    }
    case 'shop': {
      if (!isObject(raw.offers) || !isStringArray(raw.offers.heroOfferIds)) reject('shop.offers is not a shelf');
      if (!Array.isArray(raw.itemsBought) || !raw.itemsBought.every((slot) => isInt(slot, 0))) reject('shop.itemsBought is not a list of slots');
      return {
        kind,
        nodeId: nodeId(raw.nodeId, ctx, 'shop.nodeId'),
        offers: {
          heroOfferIds: [...raw.offers.heroOfferIds],
          itemIds: (Array.isArray(raw.offers.itemIds) ? raw.offers.itemIds : []).map((id, at) => itemId(id, ctx, `shop.offers.itemIds[${at}]`)),
          // A shelf saved while it sold packs stocks single Gems now.
          gems: raw.offers.gems === undefined ? rollShelfGems(ctx.run.actNumber) : decodeGems(raw.offers.gems, 'shop.offers.gems'),
        },
        gemsBought: Array.isArray(raw.gemsBought) && raw.gemsBought.every((slot) => isInt(slot, 0)) ? [...(raw.gemsBought as number[])] : [],
        rerolls: int(raw.rerolls, 'shop.rerolls'),
        itemsBought: [...(raw.itemsBought as number[])],
      };
    }
    case 'reward':
      if (raw.nodeType !== 'currencyReward' && raw.nodeType !== 'contractReward' && raw.nodeType !== 'equipmentReward') reject('reward.nodeType is unknown');
      return { kind, nodeId: nodeId(raw.nodeId, ctx, 'reward.nodeId'), nodeType: raw.nodeType, seed: int(raw.seed, 'reward.seed'), ...settled(raw) };
    case 'itemWho':
      return { kind, itemId: itemId(raw.itemId, ctx, 'itemWho.itemId'), next: next(), ...settled(raw) };
    case 'scrolls': {
      const progress = raw.progress === undefined
        ? undefined
        : isObject(raw.progress)
          ? { remaining: int(raw.progress.remaining, 'scrolls.progress.remaining'), pickedIds: rosterIds(raw.progress.pickedIds, ctx, 'scrolls.progress.pickedIds') }
          : reject('scrolls.progress is not an object');
      return {
        kind,
        plan: decodePlan(raw.plan, ctx),
        nodeId: raw.nodeId === null ? null : nodeId(raw.nodeId, ctx, 'scrolls.nodeId'),
        bought: bool(raw.bought),
        next: next(),
        ...(progress ? { progress } : {}),
      };
    }
    case 'event': {
      const eventId = str(raw.eventId, 'event.eventId');
      if (!ctx.index.eventIds.has(eventId)) reject(`event references unknown event "${eventId}"`);
      return { kind, nodeId: nodeId(raw.nodeId, ctx, 'event.nodeId'), eventId, seed: int(raw.seed, 'event.seed'), ...settled(raw) };
    }
    case 'levelUp':
      return {
        kind,
        report: decodeLevelUps(raw.report, ctx),
        next: next(),
        seed: int(raw.seed, 'levelUp.seed'),
        ...(raw.taken !== undefined ? { taken: rosterIds(raw.taken, ctx, 'levelUp.taken') } : {}),
      };
    case 'companion':
      return { kind, beat: decodeBeat(raw.beat, ctx), next: next() };
    case 'guardianBanner':
      return { kind, next: next(), ...settled(raw) };
    case 'crucible':
      return { kind, next: next(), seed: int(raw.seed, 'crucible.seed'), ...settled(raw) };
    case 'rosterReplace':
      return { kind, candidate: decodeCandidate(raw.candidate, ctx), next: next() };
    case 'recruit': {
      if (!Array.isArray(raw.offers)) reject('recruit.offers is not a list');
      const offers = raw.offers.map((entry, at) => decodeRosterEntry(entry, ctx.enemyIndex, `recruit.offers[${at}]`));
      const claimed = raw.claimedRosterIds === undefined ? undefined : isStringArray(raw.claimedRosterIds) ? [...raw.claimedRosterIds] : reject('recruit.claimedRosterIds is not a list');
      return { kind, offers, next: next(), ...(claimed ? { claimedRosterIds: claimed } : {}) };
    }
    default:
      reject(`screen "${kind}" has no reader`);
  }
}

const SIDES: readonly Side[] = ['A', 'B'];

/**
 * Structural checks on a saved board, then the board as written: it is the engine's own JSON, and
 * what a resume must refuse is a board that names content or heroes this run no longer has — that
 * is checked; a field-by-field rebuild of every status and modifier would only restate the engine.
 */
function decodeCombat(value: unknown, ctx: Ctx, fight: Extract<RunScreen, { kind: 'fight' }>): CombatSnapshot {
  if (!isObject(value) || !isObject(value.state)) reject('combat has no board');
  const state = value.state;
  if (!isInt(state.seed, 0) || !isInt(state.rngState, 0) || !isInt(state.round, 1)) reject('combat.state has no seed or round');
  if (!isObject(state.combatants) || !isObject(state.active) || !isObject(state.bench) || !isObject(state.koCount)) reject('combat.state is missing a part');
  const combatants = state.combatants as Record<string, unknown>;
  for (const [id, raw] of Object.entries(combatants)) {
    if (!isObject(raw) || raw.combatantId !== id) reject(`combat.state.combatants.${id} is keyed under a different id`);
    if (raw.side !== 'A' && raw.side !== 'B') reject(`combat.state.combatants.${id} has no side`);
    heroId(raw.heroId, ctx, `combat.state.combatants.${id}.heroId`);
    for (const key of ['currentHp', 'currentMana'] as const) {
      if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key] as number) || (raw[key] as number) < 0) reject(`combat.state.combatants.${id}.${key} is not a number`);
    }
    if (typeof raw.fainted !== 'boolean') reject(`combat.state.combatants.${id}.fainted is not a flag`);
    if (!isObject(raw.statuses) || !isObject(raw.passives) || !isObject(raw.statModifiers)) reject(`combat.state.combatants.${id} is missing a part`);
    for (const passiveId of Object.keys(raw.passives)) if (!ctx.index.passiveIds.has(passiveId)) reject(`combat.state.combatants.${id} holds unknown passive "${passiveId}"`);
  }
  for (const side of SIDES) {
    const active = (state.active as Record<string, unknown>)[side];
    if (!Array.isArray(active) || active.length !== 2) reject(`combat.state.active.${side} is not two slots`);
    for (const id of active) if (id !== null && (typeof id !== 'string' || !combatants[id])) reject(`combat.state.active.${side} names a missing combatant`);
    const bench = (state.bench as Record<string, unknown>)[side];
    if (!isStringArray(bench)) reject(`combat.state.bench.${side} is not a list`);
    for (const id of bench) if (!combatants[id]) reject(`combat.state.bench.${side} names a missing combatant`);
    if (!isInt((state.koCount as Record<string, unknown>)[side], 0)) reject(`combat.state.koCount.${side} is not a count`);
  }
  // The board is the fight the screen names: the player's side is this roster, the other its party.
  const playerIds = new Set(Object.values(combatants).filter((c) => (c as { side: string }).side === 'A').map((c) => (c as { combatantId: string }).combatantId));
  for (const entry of ctx.run.roster) {
    const placed = [...fight.squad.activeIds, ...fight.squad.benchIds, ...(fight.squad.downIds ?? [])].includes(entry.rosterId);
    if (placed && !playerIds.has(combatantIdFor('A', entry.rosterId))) reject(`combat.state has no combatant for "${entry.rosterId}"`);
  }
  const used = value.usedConsumables === undefined ? { hpPotion: 0, mpPotion: 0, revive: 0 } : decodeConsumables(value.usedConsumables);
  for (const kind of CONSUMABLE_KINDS) if (used[kind] > ctx.run.consumables[kind]) reject(`combat drank more ${kind} than the purse holds`);
  return {
    state: JSON.parse(JSON.stringify(state)) as CombatState,
    usedConsumables: used,
    leadsPending: bool(value.leadsPending),
    mvpTally: decodeTally(value.mvpTally),
  };
}

function decodeTally(value: unknown): MvpTally {
  if (!isObject(value) || !isObject(value.ledgers)) reject('combat.mvpTally is not a tally');
  const ledgers: Record<string, MvpLedger> = {};
  for (const [id, raw] of Object.entries(value.ledgers)) {
    if (!isObject(raw)) reject(`combat.mvpTally.${id} is not a ledger`);
    const n = (key: keyof MvpLedger) => {
      const v = raw[key];
      if (typeof v !== 'number' || !Number.isFinite(v)) reject(`combat.mvpTally.${id}.${key} is not a number`);
      return v;
    };
    ledgers[id] = { rosterId: id, roundsActive: n('roundsActive'), damage: n('damage'), finishes: n('finishes'), support: n('support'), anchor: n('anchor'), control: n('control') };
  }
  const map = (key: string): Record<string, string> => {
    const raw = value[key];
    if (!isObject(raw)) reject(`combat.mvpTally.${key} is not a map`);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) out[k] = str(v, `combat.mvpTally.${key}.${k}`);
    return out;
  };
  return {
    ledgers,
    shieldGranter: map('shieldGranter'),
    dotApplier: map('dotApplier'),
    lastHitter: map('lastHitter'),
    ...(typeof value.casterId === 'string' ? { casterId: value.casterId } : {}),
  };
}

/** The resumed screen, or null — never a throw — when any part of it fails against `run`. */
export function decodeResume(raw: unknown, index: SaveContentIndex, run: RunState): ResumePayload | null {
  try {
    if (!isObject(raw)) reject('resume is not an object');
    const ctx: Ctx = { index, enemyIndex: { ...index, heroIds: index.combatantIds }, run };
    const screen = decodeScreen(raw.screen, ctx, 0);
    // A board that fails costs the board, not the fight: the fight opens fresh, as it did before.
    let combat: CombatSnapshot | undefined;
    if (screen.kind === 'fight' && raw.combat !== undefined) {
      try {
        combat = decodeCombat(raw.combat, ctx, screen);
      } catch (err) {
        if (!(err instanceof Rejected)) throw err;
      }
    }
    return { screen, ...(combat ? { combat } : {}), ...(raw.actBreak === true ? { actBreak: true } : {}) };
  } catch (err) {
    if (err instanceof Rejected) return null;
    throw err;
  }
}
