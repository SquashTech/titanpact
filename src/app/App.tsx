import { useEffect, useRef, useState } from 'react';
import { initUiScale } from './uiScale';
import { useReloadOnNewBuild } from './useReloadOnNewBuild';
import { FightScreen } from '../view/combat/FightScreen';
import { TitleScreen } from '../view/run/TitleScreen';
import { DraftScreen } from '../view/run/DraftScreen';
import { SquadSelectScreen } from '../view/run/SquadSelectScreen';
import { MapScreen } from '../view/run/MapScreen';
import { ShopNodeScreen } from '../view/run/ShopNodeScreen';
import { NodeRewardScreen, type RewardNodeType } from '../view/run/NodeRewardScreen';
import { CacheOpenScreen } from '../view/run/CacheOpenScreen';
import { GuardianBannerScreen } from '../view/run/GuardianBannerScreen';
import { LevelUpScreen } from '../view/run/LevelUpScreen';
import { ForceEquipScreen } from '../view/run/ForceEquipScreen';
import { RosterReplaceScreen } from '../view/run/RosterReplaceScreen';
import { RecruitScreen } from '../view/run/RecruitScreen';
import { StatBoostScreen, type StatBoostNodeType } from '../view/run/StatBoostScreen';
import { ClassNodeScreen } from '../view/run/ClassNodeScreen';
import { EventNodeScreen } from '../view/run/EventNodeScreen';
import { runEvents } from '../data/events';
import { rollRunEvent } from '../run/events';
import { SandboxBattleScreen } from '../view/run/SandboxBattleScreen';
import { heroes } from '../data/heroes';
import { enemies, basicGoblins, BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID } from '../data/enemies';
import { ActIntroScreen } from '../view/run/ActIntroScreen';
import { equipment } from '../data/equipment';
import {
  equipItem,
  pickWeightedEquipment,
  pickWeightedEquipmentBySlot,
  rarityWeightsFor,
  type EquipmentDefinition,
  type EquipmentSlot,
  type LootSource,
} from '../run/equipment';
import { createRunState, createRosterEntry, addRosterEntry, ROSTER_CAP, TOTAL_ACTS } from '../run/state';
import {
  deriveContractOffer,
  claimContract,
  claimContractReplacing,
  recruitFromGuildHallReplacing,
  freshRosterId,
  isRecruitable,
  pickContractOffers,
  RecruitmentError,
  type GuildHallOffer,
  type RosterReplaceCandidate,
} from '../run/recruitment';
import { guildHallOffers } from '../data/recruitment';
import { rollGuildHallOffers, buyEquipment, ShopError, type GuildHallOffers } from '../run/shop';
import { generateMap, type MapNodeType } from '../run/map';
import { generateStarterOptions } from '../run/draft';
import { generateEncounter, generateGoblinChiefEncounter, appendFinalEnemy, type EncounterNodeType, type Encounter } from '../run/enemyGen';
import { actScaling, type ScalingTrack } from '../run/difficulty';
import { generateItinerary, locationBias, locationForAct } from '../run/locations';
import { locations } from '../data/locations';
import { LocationProvider } from '../view/shared/LocationContext';
import { setTrack } from '../audio/music';
import { hasTrack } from '../audio/tracks';
import { pickSquad } from '../run/squad';
import { advanceToNode, advanceToNextAct, grantCurrencyReward, grantUpgradeReward, grantContractReward } from '../run/runProgress';
import { buildSandboxSide, createEmptySandboxSide, type SandboxSideConfig } from '../run/sandbox';
import { createStatusTestSides } from '../run/statusTestFight';
import { fullMovepool, canAffordAnyLevelUp } from '../run/progression';
import { progressionTable } from '../data/progression';
import type { RunState, RosterEntry } from '../run/state';
import type { Squad } from '../run/squad';

type Screen =
  | { kind: 'title' }
  | { kind: 'draft'; optionIds: string[] }
  /** The per-act arrival beat (docs/locations.md §4) — reads its location off the run's itinerary and actNumber, so it carries no payload of its own. */
  | { kind: 'actIntro' }
  | { kind: 'map' }
  | { kind: 'squadSelect'; nodeId: string; nodeType: EncounterNodeType; encounter: Encounter }
  | {
      kind: 'fight';
      nodeId: string;
      nodeType: EncounterNodeType;
      squad: Squad;
      encounter: Encounter;
      goldReward: number;
      trainingPointsReward: number;
      /** The opener Goblin fight's guaranteed common-item drop, or (for every other fight) an equipmentDropFor roll (see handleFightResolved / handleSquadConfirmed), rolled up front at squad-confirm time so the victory screen can spotlight it — same value handleFightResolved then hands to ForceEquipScreen, rather than re-rolling after the fact. */
      equipmentReward: EquipmentDefinition | null;
    }
  | { kind: 'quickBattle'; player: Encounter; ai: Encounter }
  | { kind: 'sandboxBattle' }
  /** Built from a SandboxBattleScreen config (src/run/sandbox.ts) — `playerRelics` drives Side A's team relic modifiers, same props the real 'fight' kind already uses; Sandbox Battle has no enemy-side relic support. */
  | { kind: 'sandboxFight'; player: Encounter; ai: Encounter; playerRelics: string[] }
  /** ⚠️ TEMPORARY DEV/TEST — see src/run/statusTestFight.ts. Its own kind rather than a reuse of 'sandboxFight' so leaving it returns to the title screen instead of an unrelated (and empty) Sandbox Battle config. */
  | { kind: 'statusTestFight'; player: Encounter; ai: Encounter }
  /**
   * `offers` is rolled once at node-select time (run/shop.ts
   * rollGuildHallOffers) rather than inside GuildHallPanel's own state — see
   * shop.ts's header for why a component-local roll would reroll on every
   * equipment purchase. `soldOutEquipmentIds` rides along for exactly the same
   * reason: a bought item greys out on the shelf instead of vanishing (user
   * direction, 2026-08-31), and the purchase that greyed it out is itself what
   * unmounts the shop screen on the way through the equip gate, so
   * component-local state would forget it before it came back.
   */
  | { kind: 'shop'; nodeId: string; offers: GuildHallOffers; soldOutEquipmentIds: string[] }
  | { kind: 'reward'; nodeId: string; nodeType: RewardNodeType }
  /**
   * The Weapon/Armor/Accessory caches' opening beat (CacheOpenScreen). Not a
   * node screen in its own right — the node is already resolved and the item
   * already rolled by the time this mounts; `next` is the equip gate it hands
   * off to about 1.3 seconds later. It exists because those three nodes were
   * otherwise invisible: the map showed a cache, and what arrived was a hero
   * grid.
   */
  | { kind: 'cacheOpen'; slot: EquipmentSlot; next: Screen }
  | { kind: 'statBoost'; nodeId: string; nodeType: StatBoostNodeType }
  /** classReward node (docs/run-loop.md, ClassNodeScreen) — one screen handles both the 1-of-3 Class pick and the target-hero assignment internally, so this kind only needs the node id. */
  | { kind: 'classNode'; nodeId: string }
  /**
   * `event` node (docs/run-loop.md, src/data/events.ts). Which event this node
   * turns out to be is rolled ONCE here at node-select time and carried on the
   * screen, same discipline as the shop's offers — the screen re-renders on
   * every onRunChange, and a roll made inside it would be a different event
   * each time the run state moved. The event's own contents (which move, which
   * loot) roll inside the screen instead; see EventNodeScreen for why that one
   * is safe there.
   */
  | { kind: 'event'; nodeId: string; eventId: string }
  /**
   * The Guardian's Banner (docs/run-loop.md, GuardianBannerScreen) — the
   * fixed 1-of-3 that follows every Guardian win in acts 1-4. Not a map node:
   * it hangs off the boss win itself, so it carries no nodeId, only the
   * `next` screen the post-fight chain was already headed for.
   */
  | { kind: 'guardianBanner'; next: Screen }
  /** Forced spend gate (CLAUDE.md "training points ... must be instantly allocated before the run continues") — `next` is whatever screen would otherwise have followed. */
  | { kind: 'levelUp'; next: Screen }
  /** Forced equip-or-trash gate (user direction: no unequipped stash — every piece of gear obtained must be resolved before the run continues) — `queue` is the item(s) awaiting a decision, `next` is whatever screen would otherwise have followed. */
  | { kind: 'forceEquip'; queue: string[]; next: Screen }
  /**
   * Roster-full replacement gate (CLAUDE.md "Gaining a hero requires
   * terminating an existing one" once at ROSTER_CAP) — Guild Hall path only.
   * The Recruit Contract claim path (RecruitScreen) resolves this in-place
   * instead, so that screen keeps track of which of its offers are already
   * signed (see RosterReplaceScreen's header comment). `next` is the shop
   * screen the player returns to either way, replace confirmed or cancelled.
   */
  | { kind: 'rosterReplace'; candidate: RosterReplaceCandidate; next: Screen }
  /**
   * Recruit Contract claim (RecruitScreen) — the beaten heroes a win puts on
   * offer, sampled once in handleFightResolved so re-renders can't reshuffle
   * them. Only ever pushed when the player actually holds a contract to
   * spend: an offer that cannot be taken is a screen that teaches the player
   * their taps are decorative, so with none the run goes straight on to
   * `next` (the equip gate, the level-up gate, or the map).
   */
  | { kind: 'recruit'; offers: RosterEntry[]; next: Screen }
  | { kind: 'runComplete' }
  | { kind: 'runFailed' };

/**
 * The screens that are not inside an act. Everything else gets the current
 * Location as ambient view context (LocationContext.tsx), which is what puts
 * the place's weather, ground and horizon behind every node screen and the
 * squad select.
 *
 * Listed as the EXCEPTIONS rather than as the run-loop screens, and
 * deliberately: a new node screen should inherit the place it happens in
 * without anyone remembering to add it to a list, while the handful of
 * screens that stand outside a run are a closed, stable set. `playerRun` can
 * still hold a finished run's itinerary while the player is in the sandbox,
 * so this is checked on the screen rather than on the run.
 */
const PLACELESS_SCREENS: ReadonlySet<Screen['kind']> = new Set([
  'title',
  'draft',
  'quickBattle',
  'sandboxBattle',
  'sandboxFight',
  'statusTestFight',
  'runComplete',
  'runFailed',
]);

/**
 * Starting roster for a fresh run: the player's two drafted heroes
 * (DraftScreen — pick 2 of 4 random candidates, CLAUDE.md "every hero must
 * be viable" so runs shouldn't always open with the same pair) plus gold,
 * leaving the rest of the fixture roster to be recruited in-run via Guild
 * Hall (shop map nodes) or claimed as Recruit Contracts after a win. A fresh
 * RunMap is generated per run (docs/run-loop.md).
 */
function createStartingRun(heroIds: readonly string[]): RunState {
  let run = createRunState(0, 40);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return {
    ...run,
    map: generateMap(Math.floor(Math.random() * 2 ** 31)),
    // Drawn once, for the whole run (docs/locations.md §1): Act 1 is always
    // Wild's Edge, acts 2-5 without replacement from the rest.
    locationIds: generateItinerary(Math.floor(Math.random() * 2 ** 31)),
  };
}

/**
 * A run standing in a **chosen** Location, with a random full roster — the
 * title screen's "Visit Location" (LocationSelectOverlay). Everything past
 * the first act is a normal run: the same map, the same act chain, the same
 * arrival screen; only the two things that are normally drawn for you (which
 * place Act 1 is, and who is on the roster) are supplied here.
 *
 * The itinerary deliberately breaks the one rule generateItinerary enforces —
 * that Act 1 is always Wild's Edge (docs/locations.md §1) — because visiting
 * a location IS the request. The rest of the acts keep the without-
 * replacement property by drawing from every location except the chosen one,
 * Wild's Edge included, so a Necropolis visit can still walk into the
 * tutorial ground later rather than losing it from the run.
 *
 * A random SIX, not a drafted two: this entry point exists to see a place and
 * fight in it, and a full roster is also the only way in from the title with
 * a real bring-6-pick-4 squad select. They arrive at level 1 with their
 * authored starting kits, exactly as a drafted hero does — an underlevelled
 * party is a fair fight here, since encounter difficulty does not yet scale
 * by act (CLAUDE.md open question, docs/run-loop.md §3).
 */
function createLocationVisitRun(locationId: string): RunState {
  const heroIds = shuffled(Object.keys(heroes)).slice(0, ROSTER_CAP);
  let run = createRunState(0, 40);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  const rest = shuffled(Object.keys(locations).filter((id) => id !== locationId));
  return {
    ...run,
    map: generateMap(Math.floor(Math.random() * 2 ** 31)),
    locationIds: [locationId, ...rest].slice(0, TOTAL_ACTS),
  };
}

/** Fisher-Yates on a copy — the roster and itinerary rolls above, which are throwaway (unseeded) the same way every other entry-point roll in this file is. */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * ⚠️ TEMPORARY DEV/TEST HELPER — not a real game entry point. Fills the
 * roster (up to ROSTER_CAP) with heroes already at level EVOLUTION_LEVEL - 1
 * and grants a single Training Point, so spending it on whichever hero
 * triggers its Evolution choice immediately — skips the normal grind of
 * playing fights and leveling up 4 times per hero just to exercise the
 * Evolution UI. Remove this (and its TitleScreen button) once Evolution
 * content/UI work is done.
 */
function createLevel4TestRun(): RunState {
  const testHeroIds = Object.keys(heroes).slice(0, ROSTER_CAP);
  let run = createRunState(1, 999);
  for (const heroId of testHeroIds) {
    run = addRosterEntry(run, { ...createRosterEntry(heroId, heroId, heroes[heroId].moveIds), level: 4 });
  }
  return {
    ...run,
    map: generateMap(Math.floor(Math.random() * 2 ** 31)),
    locationIds: generateItinerary(Math.floor(Math.random() * 2 ** 31)),
  };
}

/**
 * ⚠️ TEST FIXTURE — equips a Dagger (+5 Attack) onto the Goblin Skulker in
 * the run's very first battle only, so the equip-slot inspect UI (tap a
 * filled box to read what it does) has a real item to show from turn one,
 * without waiting on the equipment-reward economy. Remove once early map
 * rows can arm encounters for real.
 */
function equipTestDagger(encounter: Encounter): Encounter {
  const roster = encounter.run.roster.map((entry) =>
    entry.heroId === 'goblinSkulker' ? { ...entry, equipment: equipItem(entry.equipment, equipment.dagger) } : entry
  );
  return { ...encounter, run: { ...encounter.run, roster } };
}

/**
 * The five encounter map-node types, the axis every per-fight payout below is
 * keyed on. Keyed on the **map** node type rather than the collapsed
 * `EncounterNodeType`: `skirmish` and `battle` both flatten to a mechanical
 * `fight` encounter (handleNodeSelected's `encounterKind`), so a function
 * taking the encounter kind physically cannot tell the two halves of the
 * map's two-word vocabulary apart.
 */
type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss';

/**
 * ## The two reward lanes (2026-09-01, per user direction)
 *
 * The map's two-word vocabulary (CLAUDE.md: **Monsters** = `fight`/`battle`,
 * **Skirmish** = `skirmish`/`elite`) used to be a naming + recruitability
 * split only — elite simply out-paid battle on *every* axis at once, which
 * made the mid-act Elite-or-Battle pick (docs/run-loop.md §1) a difficulty
 * question rather than a reward one. The three tables below turn it into a
 * trade:
 *
 * - **Monsters is the loot-and-gold lane** — a guaranteed drop and, for
 *   `battle`, the fat gold band, but only 1 Training Point.
 * - **Skirmish is the XP lane** — double the Training Points and a
 *   recruitable roster, paid for with the thin gold band and a drop that is
 *   a roll rather than a promise.
 * - **The Guardian is its own thing** — no gold, and the Banner
 *   (handleFightResolved) is the prize, so its XP no longer has to carry the
 *   whole payout.
 */
function goldRewardFor(nodeType: EncounterMapNodeType): number {
  // The Guardian pays in the Banner, not coin.
  if (nodeType === 'boss') return 0;
  // Monsters' fat band. The row-0 opener is excluded: it is deliberately the
  // run's lightest fight (see trainingPointsFor) and already ships a
  // guaranteed drop — making it the map's richest gold node too would
  // undercut every node after it.
  if (nodeType === 'battle') return 30 + Math.floor(Math.random() * 16); // 30-45
  return 15 + Math.floor(Math.random() * 11); // 15-25
}

/**
 * Training Points paid out per battle win (docs/leveling-and-ranks.md
 * "tougher fights grant more"; CLAUDE.md "After winning a fight, you are
 * given training points").
 *
 * 3 for Monsters (`fight`, `battle`), 4 for Skirmish (`skirmish`, `elite`),
 * 5 for the Guardian: an act's four fights pay **15-16**.
 *
 * Rescaled 2026-09-01 alongside the level-price curve (run/progression.ts
 * levelUpCost), and only because of it. The old figures (1 / 2 / 2, ~6-7 an
 * act) were denominated in a currency where every level cost exactly 1; under
 * a curve where taking one hero from level 1 to their Evolution costs 10, the
 * same income would have bought a single Evolution per act and nothing else,
 * which is not a brake on hyperfocus but a halt on progression.
 *
 * The figures are set so an act's income buys EITHER one hero rushed to
 * Evolution (10) with change to spare, OR the four-hero battle core lifted to
 * level 3 (12) — which is the choice the price curve exists to create. A run's
 * ~80 from fights lands a 4-hero core around level 7-8 against Act 5 enemies
 * at level 10 (run/difficulty.ts ENEMY_LEVEL_BY_ACT); the player is meant to
 * be behind on level and ahead on gear.
 *
 * Deliberately FLAT across acts. Scaling income by act would inflate the price
 * curve away, and the resulting deceleration — the same income buying fewer
 * levels every act — IS the brake. All six figures are first-pass playtest
 * numbers; only the shape is decided.
 */
function trainingPointsFor(nodeType: EncounterMapNodeType): number {
  if (nodeType === 'fight' || nodeType === 'battle') return 3;
  if (nodeType === 'boss') return 5;
  return 4;
}

/**
 * Per-fight equipment-drop odds. Monsters drop **always** — that guarantee
 * is the lane's whole identity, and it is what the row-0 opener's
 * hard-coded drop used to be alone in having. Skirmish nodes roll for it
 * instead; `elite`/`boss` roll both more often AND one loot tier ahead of
 * the act they're in (`rarityWeightsFor(act, 'elite')`, src/run/equipment.ts)
 * — so the Skirmish lane trades certainty for rarity.
 */
const EQUIPMENT_DROP_CHANCE: Record<EncounterMapNodeType, number> = {
  fight: 1,
  battle: 1,
  skirmish: 0.25,
  elite: 0.55,
  boss: 0.7,
};

/** Which act-rarity curve a node's drop rolls on — the Skirmish lane's tough half rolls a tier ahead. */
const LOOT_SOURCE: Record<EncounterMapNodeType, LootSource> = {
  fight: 'standard',
  battle: 'standard',
  skirmish: 'standard',
  elite: 'elite',
  boss: 'elite',
};

function equipmentDropFor(nodeType: EncounterMapNodeType, actNumber: number): EquipmentDefinition | null {
  if (Math.random() >= EQUIPMENT_DROP_CHANCE[nodeType]) return null;
  const weights = rarityWeightsFor(actNumber, LOOT_SOURCE[nodeType]);
  return pickWeightedEquipment(Object.values(equipment), 1, weights)[0] ?? null;
}

export function App() {
  const [playerRun, setPlayerRun] = useState<RunState>(() => createRunState(0, 40));
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const shellRef = useRef<HTMLDivElement>(null);

  /**
   * Sandbox Battle's team configs, owned here rather than inside
   * SandboxBattleScreen — App.tsx unmounts that screen while a sandbox fight
   * is in progress (swapping to the 'sandboxFight' screen kind), so
   * component-local state would be lost the instant "Start Fight" is
   * pressed. Living here lets a config survive the round trip through
   * FightScreen and back, which is the whole point of the tool.
   */
  const [sandboxSideA, setSandboxSideA] = useState<SandboxSideConfig>(() => createEmptySandboxSide());
  const [sandboxSideB, setSandboxSideB] = useState<SandboxSideConfig>(() => createEmptySandboxSide());

  useEffect(() => {
    if (shellRef.current) return initUiScale(shellRef.current);
  }, []);

  // Title screen only — a run lives in React state alone, so a reload anywhere
  // else would destroy one. See useReloadOnNewBuild's header.
  useReloadOnNewBuild(screen.kind === 'title');

  function handleClaimContract(defeated: RosterEntry): boolean {
    if (!isRecruitable(defeated.heroId, heroes)) return false;
    if (playerRun.roster.length >= ROSTER_CAP) return false;
    if (playerRun.recruitContracts <= 0) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContract(run, offer, rosterId));
    return true;
  }

  /** Roster-full variant of handleClaimContract above — FightScreen opens RosterReplaceScreen in place and calls this once the player picks who to terminate. */
  function handleClaimContractReplace(defeated: RosterEntry, terminatedRosterId: string): boolean {
    if (!isRecruitable(defeated.heroId, heroes)) return false;
    if (playerRun.recruitContracts <= 0) return false;
    const offer = deriveContractOffer(defeated);
    const rosterId = freshRosterId(playerRun, defeated.heroId);
    setPlayerRun((run) => claimContractReplacing(run, offer, rosterId, terminatedRosterId));
    return true;
  }

  /** Guild Hall recruiting at a full roster (GuildHallPanel) opens this Screen instead of recruiting directly — see the `rosterReplace` Screen kind's doc comment. */
  function handleRequestRosterReplace(offer: GuildHallOffer) {
    setScreen({ kind: 'rosterReplace', candidate: { source: 'guildHall', offer }, next: screen });
  }

  function handleSelectNode(nodeId: string) {
    const node = playerRun.map!.nodes[nodeId];
    if (
      node.type === 'fight' ||
      node.type === 'skirmish' ||
      node.type === 'battle' ||
      node.type === 'elite' ||
      node.type === 'boss'
    ) {
      // Generated here, at node-select time, rather than after squad
      // confirmation — the battle-preview screen (SquadSelectScreen) needs
      // the enemy squad to already exist so it can scout it before the
      // player commits a squad (playtest ask).
      //
      // `fight` and `battle` (docs/run-loop.md "fight vs skirmish vs battle")
      // both draw from the non-recruitable enemy pool instead of the
      // draftable hero roster — `fight` (always row 0) is 2 random basic
      // Goblins (`BASIC_GOBLIN_IDS`), an intentionally weak opener; `battle`
      // (row 4, map-facing "Monsters") is Goblin Chief plus 3 random basic
      // Goblins, a considerably tougher, still-non-recruitable alternative to
      // that row's Elite option (2026-08-23, per user direction).
      // `skirmish`/`elite`/`boss` draw from the recruitable pool.
      const isMobFight = node.type === 'fight' || node.type === 'battle';
      // `skirmish` and `battle` map nodes ARE plain `fight` encounters
      // mechanically (same heroCount, no stat bonus) — only the pool and the
      // map-facing name differ, so both collapse to 'fight' for
      // generateEncounter/FightScreen, which only need the mechanical shape.
      const encounterKind: EncounterNodeType = node.type === 'skirmish' || node.type === 'battle' ? 'fight' : node.type;
      // The run's 2nd plain-encounter node specifically (not elite/boss,
      // which have their own fixed sizing) is a deliberately lighter 2v2
      // breather between the opener and elites kicking in.
      const isSecondFight = encounterKind === 'fight' && playerRun.fightsStarted === 1;
      // The per-act difficulty curve (src/run/difficulty.ts). The track split
      // is the same pool split `isMobFight` already makes — the two families
      // scale at the same rate but from different baseline acts, because the
      // monster pool's content is still a placeholder for per-act monster
      // tiers that don't exist yet.
      const track: ScalingTrack = isMobFight ? 'monsters' : 'skirmish';
      const scaling = actScaling(track, playerRun.actNumber);
      let encounter: Encounter;
      if (node.type === 'battle') {
        encounter = generateGoblinChiefEncounter(
          Math.floor(Math.random() * 2 ** 31),
          BASIC_GOBLIN_IDS,
          GOBLIN_CHIEF_ID,
          enemies,
          scaling
        );
      } else {
        const encounterPool = node.type === 'fight' ? basicGoblins : heroes;
        // A hero already on the roster is barred from the recruitable pool
        // outright (2026-08-31, user direction): every recruitable-pool node
        // can hand its beaten heroes over as a Recruit Contract, so a
        // spawn the player already owns is the one way two copies of the same
        // hero could end up on one roster. Barring the SPAWN rather than the
        // claim is what keeps the rule invisible — the player never sees the
        // offer they'd have to be told no about — and it matches the Guild
        // Hall shelf, which has always filtered its own offers the same way
        // (src/run/shop.ts `rollGuildHallOffers`).
        const excludeHeroIds = encounterPool === heroes ? playerRun.roster.map((r) => r.heroId) : undefined;
        const heroCountOverride = node.type === 'fight' ? 2 : isSecondFight ? 2 : undefined;
        // The act's Location weights which heroes show up (docs/locations.md
        // §2) — all but one slot drawn from its affinity types, the last from
        // anywhere. Recruitable-pool nodes only: the Goblin pool is the
        // faction's, and factions are not type-themed yet ("The faction
        // bill"). Wild's Edge has a null affinity and so returns no bias at
        // all, which is exactly the uniform pick Act 1 had before this.
        const heroCount = heroCountOverride ?? (encounterKind === 'boss' ? 2 : 4);
        const bias =
          encounterPool === heroes
            ? locationBias(locationForAct(playerRun.locationIds, playerRun.actNumber), heroes, heroCount)
            : undefined;
        encounter = generateEncounter(encounterKind, Math.floor(Math.random() * 2 ** 31), encounterPool, {
          heroCount: heroCountOverride,
          bias,
          excludeHeroIds,
          scaling,
          // Cashes the act's enemy level in for Evolutions and extra moves.
          // The Goblin pool has no progression data, so passing it there is a
          // no-op rather than a special case worth branching on.
          progression: progressionTable,
        });
        // The act's Location may hold a faction champion back for its Guardian
        // fight (data/locations.ts `guardianFinalEnemyId` — Wild's Edge's
        // Goblin Lord, and nothing else today). Benched, so the fight's first
        // enemy KO is what brings him in: he is the LAST thing to reach the
        // field, which is the whole design (src/run/enemyGen.ts
        // `appendFinalEnemy`).
        const finalEnemyId =
          node.type === 'boss' ? locationForAct(playerRun.locationIds, playerRun.actNumber).guardianFinalEnemyId : null;
        if (finalEnemyId) {
          encounter = appendFinalEnemy(encounter, finalEnemyId, enemies, Math.floor(Math.random() * 2 ** 31), scaling);
        }
      }
      const isFirstFight = encounterKind === 'fight' && playerRun.fightsStarted === 0;
      if (isMobFight && isFirstFight) {
        encounter = equipTestDagger(encounter);
      }
      if (encounterKind === 'fight') {
        setPlayerRun((run) => ({ ...run, fightsStarted: run.fightsStarted + 1 }));
      }
      // With 2 or fewer heroes on the roster, the whole roster is mandatory
      // and starts active — there's no bench/active split to decide, so the
      // battle-preview screen (SquadSelectScreen) would just be a forced,
      // decision-free tap. Skip straight into the fight with the full roster.
      if (playerRun.roster.length <= 2) {
        const squad = pickSquad(playerRun.roster, playerRun.roster.map((r) => r.rosterId));
        handleSquadConfirmed(squad, nodeId, encounterKind, encounter);
      } else {
        setScreen({ kind: 'squadSelect', nodeId, nodeType: encounterKind, encounter });
      }
    } else if (node.type === 'shop') {
      setScreen({
        kind: 'shop',
        nodeId,
        offers: rollGuildHallOffers(playerRun, guildHallOffers, Object.values(equipment)),
        soldOutEquipmentIds: [],
      });
    } else if (node.type === 'weaponReward' || node.type === 'armorReward' || node.type === 'accessoryReward') {
      // Single guaranteed item of a fixed slot, no 3-choice picker — rolls
      // through the cache-opening beat and into the forced equip-or-trash
      // gate. The beat is the only thing on this path that says which node the
      // player pressed: without it the map's Weapon Cache resolved into a
      // ForceEquipScreen hero grid with no cache anywhere in it.
      const slot: EquipmentSlot = node.type === 'weaponReward' ? 'weapon' : node.type === 'armorReward' ? 'armor' : 'accessory';
      const item = pickWeightedEquipmentBySlot(Object.values(equipment), slot, rarityWeightsFor(playerRun.actNumber, 'standard'));
      setPlayerRun((run) => advanceToNode(run, nodeId));
      const afterScreen: Screen = canAffordAnyLevelUp(playerRun) ? { kind: 'levelUp', next: { kind: 'map' } } : { kind: 'map' };
      setScreen(
        item ? { kind: 'cacheOpen', slot, next: { kind: 'forceEquip', queue: [item.id], next: afterScreen } } : afterScreen
      );
    } else if (node.type === 'hpBoostReward' || node.type === 'manaBoostReward' || node.type === 'manaRegenBoostReward') {
      setScreen({ kind: 'statBoost', nodeId, nodeType: node.type });
    } else if (node.type === 'classReward') {
      setScreen({ kind: 'classNode', nodeId });
    } else if (node.type === 'event') {
      // Location is passed so a Location-gated event (src/data/events.ts
      // `locationIds`) can be authored later without touching this call site.
      const location = locationForAct(playerRun.locationIds, playerRun.actNumber);
      const rolled = rollRunEvent(runEvents, playerRun.actNumber, location.id);
      // Nothing eligible is not a crash: skip the node rather than stranding
      // the player on a screen with no content, exactly as a contract-less win
      // skips the recruit offer.
      if (rolled) setScreen({ kind: 'event', nodeId, eventId: rolled.id });
      else handleNodeContinue(nodeId);
    } else {
      setScreen({ kind: 'reward', nodeId, nodeType: node.type });
    }
  }

  function handleSquadConfirmed(squad: Squad, nodeId: string, nodeType: EncounterNodeType, encounter: Encounter) {
    // Every payout reads off the **map** node type, not the collapsed
    // `nodeType` the fight itself runs on — see EncounterMapNodeType above:
    // `skirmish` and `battle` are indistinguishable once flattened, and they
    // now sit in opposite reward lanes.
    //
    // The Monsters lane's guaranteed drop (EQUIPMENT_DROP_CHANCE = 1) used to
    // be a hard-coded special case for the row-0 opener alone; it is now the
    // lane's rule, so there is no branch here. It rolls the act's own
    // standard curve rather than a hard-coded Common: in Act 1 that is ~65%
    // Common anyway, and by Act 5 Commons no longer exist to hand out
    // (rarityWeightsFor, src/run/equipment.ts). Rolled here, before the fight
    // even starts, so the victory screen can spotlight the exact item that's
    // coming — handleFightResolved below reuses this same value instead of
    // re-rolling.
    const mapNodeType = playerRun.map!.nodes[nodeId].type as EncounterMapNodeType;
    const equipmentReward = equipmentDropFor(mapNodeType, playerRun.actNumber);
    setScreen({
      kind: 'fight',
      nodeId,
      nodeType,
      squad,
      encounter,
      goldReward: goldRewardFor(mapNodeType),
      trainingPointsReward: trainingPointsFor(mapNodeType),
      equipmentReward,
    });
  }

  function handleFightResolved(
    nodeId: string,
    nodeType: EncounterNodeType,
    goldReward: number,
    trainingPointsReward: number,
    equipmentReward: EquipmentDefinition | null,
    /** This fight's AI roster — the beaten builds a Recruit Contract can claim (RecruitScreen below). */
    defeatedRoster: readonly RosterEntry[],
    outcome: 'win' | 'loss'
  ) {
    if (outcome === 'loss') {
      setScreen({ kind: 'runFailed' });
      return;
    }
    const isBossNode = nodeId === playerRun.map!.bossNodeId;
    // The Guardian's Banner rides on every Guardian win EXCEPT the last one
    // — act 5's Guardian ends the run, and a team-wide permanent granted
    // onto a finished run is a choice with nothing left to spend it on.
    // Read off `playerRun`, before advanceToNextAct below bumps actNumber.
    const banner = isBossNode && playerRun.actNumber < TOTAL_ACTS;

    let next = grantCurrencyReward(playerRun, goldReward);
    next = grantUpgradeReward(next, trainingPointsReward);
    next = advanceToNode(next, nodeId);

    // End of act (docs/run-loop.md "Multi-act sequencing"): a Recruit
    // Contract per act, replacing the old contractReward map node, then
    // either chain into the next act's fresh map or, past the last act, end
    // the run.
    let afterScreen: Screen;
    if (isBossNode) {
      next = grantContractReward(next, 1);
      if (next.actNumber < TOTAL_ACTS) {
        next = advanceToNextAct(next, Math.floor(Math.random() * 2 ** 31));
        // ...and so does every act after the first: the arrival screen is the
        // per-act beat, not an Act-1 title card (docs/locations.md §4).
        afterScreen = { kind: 'actIntro' };
      } else {
        afterScreen = { kind: 'runComplete' };
      }
    } else {
      afterScreen = { kind: 'map' };
    }

    setPlayerRun(next);
    const afterLevelUp: Screen = canAffordAnyLevelUp(next) ? { kind: 'levelUp', next: afterScreen } : afterScreen;
    const afterEquip: Screen = equipmentReward ? { kind: 'forceEquip', queue: [equipmentReward.id], next: afterLevelUp } : afterLevelUp;

    // The Recruit Contract claim, first of the post-fight gates: recruiting
    // before the equip and level-up gates means the gear and the Training
    // Points this same win paid out can go to the hero who just joined,
    // rather than arriving one node too late for them.
    //
    // `next`, not `playerRun` — a boss node has already granted this act's
    // contract by here, and that contract is spendable on the very heroes
    // that boss fight just beat. With none held, no screen: the offer is
    // dropped rather than shown unclaimable.
    const contractOffers =
      next.recruitContracts > 0 ? pickContractOffers(defeatedRoster.filter((entry) => isRecruitable(entry.heroId, heroes))) : [];

    const afterRecruit: Screen = contractOffers.length > 0 ? { kind: 'recruit', offers: contractOffers, next: afterEquip } : afterEquip;

    // The banner goes FIRST, ahead of the recruit/equip/level-up gates: it is
    // the Guardian's own prize, and putting it in front means the hero a
    // contract recruits this same beat already arrives under it.
    setScreen(banner ? { kind: 'guardianBanner', next: afterRecruit } : afterRecruit);
  }

  function handleNodeContinue(nodeId: string) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    setScreen(canAffordAnyLevelUp(playerRun) ? { kind: 'levelUp', next: { kind: 'map' } } : { kind: 'map' });
  }

  /**
   * equipmentReward node resolution: claiming an item immediately hands off
   * to the forced equip-or-trash gate (ForceEquipScreen) instead of stashing
   * it — mirrors handleFightResolved's Goblin-fight drop, but also advances
   * the map node first since NodeRewardScreen no longer has its own Continue
   * button for this node type.
   *
   * Takes a QUEUE rather than one item because the Loot Pile event
   * (src/data/events.ts) hands over three at once. ForceEquipScreen already
   * walks a queue — a bumped item joins it mid-flow — so this needed no new
   * machinery, only the plural.
   */
  function handleClaimEquipment(nodeId: string, itemIds: string | string[]) {
    setPlayerRun((run) => advanceToNode(run, nodeId));
    const afterScreen: Screen = canAffordAnyLevelUp(playerRun) ? { kind: 'levelUp', next: { kind: 'map' } } : { kind: 'map' };
    setScreen({ kind: 'forceEquip', queue: Array.isArray(itemIds) ? itemIds : [itemIds], next: afterScreen });
  }

  /**
   * Guild Hall equipment purchase (ShopNodeScreen): spends gold, then hands
   * off to the same forced equip-or-trash gate every other equipment grant
   * uses. `next` is the current shop screen itself, not the map — buying
   * gear doesn't advance the map node, so the player lands back in the same
   * Guild Hall to keep shopping once the item is placed. Computes against
   * `playerRun` directly and only commits on success, same
   * validate-before-commit shape as GuildHallPanel's own recruit/contract
   * handlers, rather than throwing inside a setState updater.
   *
   * The shop screen the player returns to is the current one with the bought
   * item added to `soldOutEquipmentIds` — the shelf keeps the card, greyed,
   * rather than dropping it (user direction, 2026-08-31).
   */
  function handleBuyGuildEquipment(itemId: string) {
    const item = equipment[itemId];
    if (!item) return;
    let next: RunState;
    try {
      next = buyEquipment(playerRun, item);
    } catch (err) {
      if (!(err instanceof ShopError)) throw err;
      return;
    }
    setPlayerRun(next);
    const backToShop: Screen =
      screen.kind === 'shop' ? { ...screen, soldOutEquipmentIds: [...screen.soldOutEquipmentIds, itemId] } : screen;
    setScreen({ kind: 'forceEquip', queue: [itemId], next: backToShop });
  }

  /** "Start a Run" from the title screen opens the draft (DraftScreen) rather than building the run directly — the starting pair isn't chosen yet. */
  function handleStartNewRun() {
    const starterHeroIds = Object.values(heroes)
      .filter((hero) => hero.starter)
      .map((hero) => hero.id);
    const optionIds = generateStarterOptions(Math.floor(Math.random() * 2 ** 31), starterHeroIds);
    setScreen({ kind: 'draft', optionIds });
  }

  function handleDraftConfirm(chosenIds: string[]) {
    setPlayerRun(createStartingRun(chosenIds));
    // Act 1's arrival screen sits between the draft and the map — the player
    // should know where they are standing before they read the map of it.
    setScreen({ kind: 'actIntro' });
  }

  /** ⚠️ TEMPORARY DEV/TEST — see createLevel4TestRun. Drops straight into the level-up/Evolution screen instead of the draft, since that's the whole point of this shortcut. */
  function handleStartLevel4TestRun() {
    setPlayerRun(createLevel4TestRun());
    setScreen({ kind: 'levelUp', next: { kind: 'map' } });
  }


  /**
   * Randomizes a full 4v4 (both sides drawn fresh from the fixture hero
   * pool, no Evolution bonuses) and drops straight into FightScreen — bypasses
   * the run/map/squad-select loop entirely so combat/UI changes can be
   * iterated on without playing through a run each time.
   *
   * Every hero here rolls MOVE_CAP moves at random from its FULL movepool
   * (starting kit + level-up pool, src/run/progression.ts fullMovepool)
   * rather than its authored 3-move starting kit — a throwaway fight is the
   * one place worth spending on coverage, so the moves a hero would only see
   * several levels into a run show up here immediately. Real map nodes keep
   * the authored kits.
   */
  function handleQuickBattle() {
    const movepools = Object.fromEntries(Object.values(heroes).map((hero) => [hero.id, fullMovepool(progressionTable, hero)]));
    const player = generateEncounter('fight', Math.floor(Math.random() * 2 ** 31), heroes, { movepools });
    const ai = generateEncounter('fight', Math.floor(Math.random() * 2 ** 31), heroes, { movepools });
    setScreen({ kind: 'quickBattle', player, ai });
  }

  function handleOpenSandbox() {
    setScreen({ kind: 'sandboxBattle' });
  }

  /**
   * "Visit Location" (LocationSelectOverlay) — builds a run already standing
   * in the chosen place (createLocationVisitRun) and enters through the
   * normal arrival screen rather than jumping to the map, since the arrival
   * beat is most of what there is to see about a Location.
   */
  function handleVisitLocation(locationId: string) {
    setPlayerRun(createLocationVisitRun(locationId));
    setScreen({ kind: 'actIntro' });
  }

  /**
   * Builds both sides via buildSandboxSide (src/run/sandbox.ts) and drops
   * straight into FightScreen. Unlike Quick Battle, onResolved below returns
   * to the Sandbox Battle screen (not title) — the whole point of this tool
   * is tweak-and-rerun without losing the configuration just tested.
   */
  function handleSandboxFight(a: SandboxSideConfig, b: SandboxSideConfig) {
    const player = buildSandboxSide(a, heroes, progressionTable);
    const ai = buildSandboxSide(b, heroes, progressionTable);
    setScreen({ kind: 'sandboxFight', player, ai, playerRelics: a.relicIds });
  }

  /**
   * ⚠️ TEMPORARY DEV/TEST — see src/run/statusTestFight.ts for what this
   * fight is and why. Goes through the same buildSandboxSide path as Sandbox
   * Battle (so it exercises the real run -> combat seam rather than a special
   * case), just from a fixed config instead of a user-built one.
   */
  function handleStatusTestFight() {
    const { a, b } = createStatusTestSides();
    setScreen({
      kind: 'statusTestFight',
      player: buildSandboxSide(a, heroes, progressionTable),
      ai: buildSandboxSide(b, heroes, progressionTable),
    });
  }

  // Null outside an act, which is what keeps the title and the sandbox tools
  // on the plain, placeless node sky they have always had — see
  // PLACELESS_SCREENS and LocationContext.tsx.
  const ambientLocation =
    PLACELESS_SCREENS.has(screen.kind) || playerRun.locationIds.length === 0
      ? null
      : locationForAct(playerRun.locationIds, playerRun.actNumber);

  /* The whole music integration: the act's location IS the track. Because
     `ambientLocation` is computed here, above the screen switch, it does not
     change when the player walks from the map into a fight and back — so
     neither does the music, which keeps playing across the transition rather
     than restarting per screen. `setTrack` is idempotent on the id, so
     running this on every render costs nothing (audio/music.ts).

     A location with no authored track yet falls to null and fades out, which
     is the honest result: silence, not the previous act's music following
     the player into a place it doesn't belong to. */
  useEffect(() => {
    setTrack(hasTrack(ambientLocation?.id) ? ambientLocation.id : null);
  }, [ambientLocation?.id]);

  return (
    <LocationProvider location={ambientLocation}>
    <div className="app-shell" ref={shellRef}>
      {screen.kind === 'title' && (
        <TitleScreen
          onStartRun={handleStartNewRun}
          onQuickBattle={handleQuickBattle}
          onOpenSandbox={handleOpenSandbox}
          onVisitLocation={handleVisitLocation}
          onStartLevel4TestRun={handleStartLevel4TestRun}
          onStartStatusTestFight={handleStatusTestFight}
        />
      )}

      {screen.kind === 'sandboxBattle' && (
        <SandboxBattleScreen
          sideA={sandboxSideA}
          sideB={sandboxSideB}
          onChangeSideA={setSandboxSideA}
          onChangeSideB={setSandboxSideB}
          onStartFight={handleSandboxFight}
          onClose={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'sandboxFight' && (
        <FightScreen
          playerRun={screen.player.run}
          playerSquad={screen.player.squad}
          aiRun={screen.ai.run}
          aiSquad={screen.ai.squad}
          playerRelicIds={screen.playerRelics}
          goldReward={0}
          trainingPointsReward={0}
          equipmentReward={null}
          onResolved={() => setScreen({ kind: 'sandboxBattle' })}
        />
      )}

      {screen.kind === 'statusTestFight' && (
        <FightScreen
          playerRun={screen.player.run}
          playerSquad={screen.player.squad}
          aiRun={screen.ai.run}
          aiSquad={screen.ai.squad}
          goldReward={0}
          trainingPointsReward={0}
          equipmentReward={null}
          onResolved={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'draft' && <DraftScreen optionIds={screen.optionIds} onConfirm={handleDraftConfirm} />}

      {screen.kind === 'actIntro' && (
        <ActIntroScreen
          run={playerRun}
          location={locationForAct(playerRun.locationIds, playerRun.actNumber)}
          onEnter={() => setScreen({ kind: 'map' })}
        />
      )}

      {screen.kind === 'map' && (
        <MapScreen
          run={playerRun}
          onRunChange={setPlayerRun}
          onSelectNode={handleSelectNode}
          onQuitToTitle={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'squadSelect' && (
        <SquadSelectScreen
          run={playerRun}
          encounter={screen.encounter}
          onRunChange={setPlayerRun}
          onConfirm={(squad) => handleSquadConfirmed(squad, screen.nodeId, screen.nodeType, screen.encounter)}
        />
      )}

      {screen.kind === 'fight' && (
        <FightScreen
          playerRun={playerRun}
          playerSquad={screen.squad}
          aiRun={screen.encounter.run}
          aiSquad={screen.encounter.squad}
          playerRelicIds={playerRun.relics}
          goldReward={screen.goldReward}
          trainingPointsReward={screen.trainingPointsReward}
          equipmentReward={screen.equipmentReward}
          onResolved={(outcome) =>
            handleFightResolved(
              screen.nodeId,
              screen.nodeType,
              screen.goldReward,
              screen.trainingPointsReward,
              screen.equipmentReward,
              screen.encounter.run.roster,
              outcome
            )
          }
          /* Abandon this run from the fight's Options menu. Nothing to tear
             down: RunState lives in this component's state and a new run
             replaces it wholesale, so returning to the title is the whole
             operation. */
          onQuitToTitle={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'quickBattle' && (
        <FightScreen
          playerRun={screen.player.run}
          playerSquad={screen.player.squad}
          aiRun={screen.ai.run}
          aiSquad={screen.ai.squad}
          goldReward={0}
          trainingPointsReward={0}
          equipmentReward={null}
          onResolved={() => setScreen({ kind: 'title' })}
          /* No run behind a Quick Battle, so leaving mid-fight costs
             nothing — a plain one-tap exit, not the armed quit the run
             fights get. Rerolling a throwaway matchup is the whole point of
             the mode, and bouncing off the title is how you do it. */
          onExitToTitle={() => setScreen({ kind: 'title' })}
        />
      )}

      {screen.kind === 'shop' && (
        <ShopNodeScreen
          run={playerRun}
          offers={screen.offers}
          soldOutEquipmentIds={screen.soldOutEquipmentIds}
          onRunChange={setPlayerRun}
          onBuyEquipment={handleBuyGuildEquipment}
          onRequestRosterReplace={handleRequestRosterReplace}
          onContinue={() => handleNodeContinue(screen.nodeId)}
        />
      )}

      {screen.kind === 'recruit' && (
        <RecruitScreen
          run={playerRun}
          offers={screen.offers}
          onClaim={handleClaimContract}
          onClaimReplace={handleClaimContractReplace}
          onDone={() => setScreen(screen.next)}
        />
      )}

      {screen.kind === 'rosterReplace' && (
        <RosterReplaceScreen
          roster={playerRun.roster}
          candidate={screen.candidate}
          relicIds={playerRun.relics}
          onConfirm={(terminatedRosterId) => {
            const { candidate } = screen;
            try {
              const rosterId = freshRosterId(playerRun, candidate.offer.heroId);
              const nextRun =
                candidate.source === 'guildHall'
                  ? recruitFromGuildHallReplacing(playerRun, candidate.offer, rosterId, terminatedRosterId)
                  : claimContractReplacing(playerRun, candidate.offer, rosterId, terminatedRosterId);
              setPlayerRun(nextRun);
              setScreen(screen.next);
              return true;
            } catch (err) {
              if (!(err instanceof RecruitmentError)) throw err;
              return false;
            }
          }}
          onCancel={() => setScreen(screen.next)}
        />
      )}

      {screen.kind === 'reward' && (
        <NodeRewardScreen
          nodeType={screen.nodeType}
          run={playerRun}
          onRunChange={setPlayerRun}
          onContinue={() => handleNodeContinue(screen.nodeId)}
          onClaimEquipment={(itemId) => handleClaimEquipment(screen.nodeId, itemId)}
        />
      )}

      {screen.kind === 'cacheOpen' && (
        <CacheOpenScreen slot={screen.slot} onDone={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'statBoost' && (
        <StatBoostScreen
          nodeType={screen.nodeType}
          run={playerRun}
          onRunChange={setPlayerRun}
          onContinue={() => handleNodeContinue(screen.nodeId)}
        />
      )}

      {screen.kind === 'classNode' && (
        <ClassNodeScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => handleNodeContinue(screen.nodeId)} />
      )}

      {screen.kind === 'event' &&
        runEvents[screen.eventId] &&
        (() => {
          const { nodeId, eventId } = screen;
          return (
            <EventNodeScreen
              event={runEvents[eventId]}
              run={playerRun}
              onRunChange={setPlayerRun}
              onGrantEquipment={(itemIds) => handleClaimEquipment(nodeId, itemIds)}
              onContinue={() => handleNodeContinue(nodeId)}
            />
          );
        })()}

      {screen.kind === 'guardianBanner' && (
        <GuardianBannerScreen run={playerRun} onRunChange={setPlayerRun} onContinue={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'levelUp' && (
        <LevelUpScreen run={playerRun} onRunChange={setPlayerRun} onDone={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'forceEquip' && (
        <ForceEquipScreen run={playerRun} queue={screen.queue} onRunChange={setPlayerRun} onDone={() => setScreen(screen.next)} />
      )}

      {screen.kind === 'runComplete' && (
        <div className="result-overlay">
          <h2>Run Complete!</h2>
          <p className="hint">You defeated the Guardian {TOTAL_ACTS} times. All acts are cleared.</p>
          <div className="result-buttons">
            <button onClick={handleStartNewRun}>Start New Run</button>
          </div>
        </div>
      )}

      {screen.kind === 'runFailed' && (
        <div className="result-overlay">
          <h2>Run Failed</h2>
          <p className="hint">Your squad was defeated.</p>
          <div className="result-buttons">
            <button onClick={handleStartNewRun}>Start New Run</button>
          </div>
        </div>
      )}
    </div>
    </LocationProvider>
  );
}
