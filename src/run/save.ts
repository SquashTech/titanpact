// Run persistence: the save file's shape, and the validation a load has to pass.
//
// A run otherwise lives only in React state (src/app/App.tsx), so an OS-killed tab
// destroys one. This module is the pure half — encode, decode, validate. It imports
// no content and touches no storage; src/app/saveStorage.ts owns localStorage and
// feeds the real catalogs in through SaveContentIndex.
//
// Loading is deliberately ALL-OR-NOTHING. A save referencing content this build no
// longer ships (a removed move, a renamed relic) is rejected, never repaired: a run
// patched back to life keeps playing with stat grants that quietly vanished, and the
// player has no way to see that it happened. A refused save says so once and costs
// one run; a silently broken one poisons every fight after it.

import type { PassiveId, StatKey, TypeId } from '../engine/content';
import { STAT_ORDER } from '../engine/content';
import type { EquipmentLoadout, EquipmentSlot } from './equipment';
import { createEmptyLoadout } from './equipment';
import type { MapNode, MapNodeType, RunMap } from './map';
import { MAP_NODE_TYPES } from './map';
import type { ProgressionTable } from './progression';
import type { BrokenSeal, RosterEntry, RunState } from './state';
import { ROSTER_CAP, TOTAL_ACTS } from './state';

/**
 * Bump whenever a change to RunState or RunMap makes older files unreadable. Older versions
 * are refused, not migrated — the same all-or-nothing stance as the content checks below.
 * v2 (2026-09-04): RunState gained `encountersWon`.
 * v3 (2026-09-05): the finale act — RunState gained `brokenSeals`, TOTAL_ACTS went 5 -> 6,
 * and an itinerary gained its sixth entry. A v2 run would arrive at Act 6 with no ledger
 * to field and no location to stand in.
 */
export const SAVE_VERSION = 3;

/**
 * Where a restored run resumes. Both are settled points: every reward is banked, the
 * node is marked visited, and nothing is mid-roll — so re-entering costs the player
 * nothing and can hand out nothing twice. Screens that hold a rolled-but-unclaimed
 * offer (a shop's stock, a fight's encounter, an equip queue) are deliberately NOT
 * checkpoints; interrupting one rewinds to the map.
 */
export type SaveCheckpoint = 'map' | 'actIntro';

export interface SavedRun {
  version: number;
  /** ms epoch. Feeds the title screen's "saved ..." line and nothing mechanical. */
  savedAt: number;
  checkpoint: SaveCheckpoint;
  run: RunState;
}

/**
 * The id sets a load is checked against. Passed in rather than imported so this module
 * stays data-free and a test can validate against a trimmed catalog.
 */
export interface SaveContentIndex {
  heroIds: ReadonlySet<string>;
  moveIds: ReadonlySet<string>;
  equipmentIds: ReadonlySet<string>;
  relicIds: ReadonlySet<string>;
  passiveIds: ReadonlySet<PassiveId>;
  classIds: ReadonlySet<PassiveId>;
  locationIds: ReadonlySet<string>;
  championIds: ReadonlySet<string>;
  typeIds: ReadonlySet<TypeId>;
  evolutionPathIds: ReadonlySet<string>;
}

export type LoadResult = { ok: true; save: SavedRun } | { ok: false; reason: string };

/**
 * The catalogs an index is built from. Typed by their KEYS only (`Record<string, unknown>`)
 * because that is all validation reads — which also keeps this module from importing the
 * five definition types it would otherwise need purely for decoration.
 */
export interface SaveCatalogs {
  heroes: Record<string, unknown>;
  moves: Record<string, unknown>;
  equipment: Record<string, unknown>;
  relics: Record<string, unknown>;
  passives: Record<string, unknown>;
  classes: Record<string, unknown>;
  locations: Record<string, unknown>;
  /** Faction champion ids (enemies.ts CHAMPION_IDS) — a broken seal names one, and it is never a hero. */
  championIds: readonly string[];
  types: readonly string[];
  progression: ProgressionTable;
}

/**
 * Lives here rather than beside the data imports so the node test build — which does not
 * include src/app — can validate against the shipping catalogs too.
 */
export function buildContentIndex(catalogs: SaveCatalogs): SaveContentIndex {
  const evolutionPathIds = new Set<string>();
  for (const nodes of Object.values(catalogs.progression.evolutions)) {
    for (const node of nodes) for (const path of node.paths) evolutionPathIds.add(path.id);
  }
  return {
    heroIds: new Set(Object.keys(catalogs.heroes)),
    moveIds: new Set(Object.keys(catalogs.moves)),
    equipmentIds: new Set(Object.keys(catalogs.equipment)),
    relicIds: new Set(Object.keys(catalogs.relics)),
    passiveIds: new Set(Object.keys(catalogs.passives)),
    // Narrow on purpose: `passives` folds the Class catalog in, but a classId must name a Class.
    classIds: new Set(Object.keys(catalogs.classes)),
    locationIds: new Set(Object.keys(catalogs.locations)),
    championIds: new Set(catalogs.championIds),
    typeIds: new Set<string>(catalogs.types),
    evolutionPathIds,
  };
}

/** What the title screen needs to describe a save without loading it into a run. */
export interface SaveSummary {
  actNumber: number;
  rosterSize: number;
  savedAt: number;
  /** The act's location, for the Continue card's art. Null on a run whose itinerary is empty. */
  locationId: string | null;
}

// --- Encoding ---

export function encodeSave(run: RunState, checkpoint: SaveCheckpoint, now = Date.now()): SavedRun {
  return { version: SAVE_VERSION, savedAt: now, checkpoint, run };
}

export function saveSummary(save: SavedRun): SaveSummary {
  return {
    actNumber: save.run.actNumber,
    rosterSize: save.run.roster.length,
    savedAt: save.savedAt,
    locationId: save.run.locationIds[save.run.actNumber - 1] ?? null,
  };
}

// --- Decoding ---

/** Internal control flow only: every rejection carries the reason the caller reports. */
class Rejected extends Error {}

function reject(reason: string): never {
  throw new Rejected(reason);
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function requireIds(value: unknown, known: ReadonlySet<string>, label: string): string[] {
  if (!isStringArray(value)) reject(`${label} is not a list of ids`);
  for (const id of value) if (!known.has(id)) reject(`${label} references unknown content "${id}"`);
  return [...value];
}

const STAT_KEYS: ReadonlySet<string> = new Set<string>(STAT_ORDER);
const SLOTS: readonly EquipmentSlot[] = ['weapon', 'armor', 'accessory'];
const NODE_TYPES: ReadonlySet<string> = new Set<string>(MAP_NODE_TYPES);

function decodeStatGrants(value: unknown, label: string): Partial<Record<StatKey, number>> {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) reject(`${label} is not a stat map`);
  const out: Partial<Record<StatKey, number>> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (!STAT_KEYS.has(key)) reject(`${label} names unknown stat "${key}"`);
    if (typeof amount !== 'number' || !Number.isFinite(amount)) reject(`${label}.${key} is not a number`);
    out[key as StatKey] = amount;
  }
  return out;
}

function decodeLoadout(value: unknown, index: SaveContentIndex, label: string): EquipmentLoadout {
  if (!isObject(value)) reject(`${label} is not an equipment loadout`);
  const out = createEmptyLoadout();
  for (const slot of SLOTS) {
    const id = value[slot];
    if (id === null || id === undefined) continue;
    if (typeof id !== 'string') reject(`${label}.${slot} is not an item id`);
    if (!index.equipmentIds.has(id)) reject(`${label}.${slot} references unknown equipment "${id}"`);
    out[slot] = id;
  }
  return out;
}

function decodeRosterEntry(value: unknown, index: SaveContentIndex, at: number): RosterEntry {
  const label = `roster[${at}]`;
  if (!isObject(value)) reject(`${label} is not an object`);
  if (typeof value.rosterId !== 'string' || value.rosterId.length === 0) reject(`${label}.rosterId is missing`);
  if (typeof value.heroId !== 'string') reject(`${label}.heroId is missing`);
  if (!index.heroIds.has(value.heroId)) reject(`${label} references unknown hero "${value.heroId}"`);
  if (!isInt(value.level, 1)) reject(`${label}.level is not a level`);

  const classId = value.classId ?? null;
  if (classId !== null) {
    if (typeof classId !== 'string') reject(`${label}.classId is not an id`);
    if (!index.classIds.has(classId)) reject(`${label} references unknown class "${classId}"`);
  }

  const graft = value.evolutionTypeGraft ?? null;
  if (graft !== null) {
    if (typeof graft !== 'string') reject(`${label}.evolutionTypeGraft is not a type`);
    if (!index.typeIds.has(graft)) reject(`${label} references unknown type "${graft}"`);
  }

  return {
    rosterId: value.rosterId,
    heroId: value.heroId,
    equipment: decodeLoadout(value.equipment, index, `${label}.equipment`),
    unlockedMoveIds: requireIds(value.unlockedMoveIds, index.moveIds, `${label}.unlockedMoveIds`),
    level: value.level,
    chosenPathIds: requireIds(value.chosenPathIds, index.evolutionPathIds, `${label}.chosenPathIds`),
    evolutionStatGrants: decodeStatGrants(value.evolutionStatGrants, `${label}.evolutionStatGrants`),
    evolutionPassiveGrants: requireIds(value.evolutionPassiveGrants, index.passiveIds, `${label}.evolutionPassiveGrants`),
    bonusPassiveGrants: requireIds(value.bonusPassiveGrants, index.passiveIds, `${label}.bonusPassiveGrants`),
    bonusStatGrants: decodeStatGrants(value.bonusStatGrants, `${label}.bonusStatGrants`),
    masteryStatGrants: decodeStatGrants(value.masteryStatGrants, `${label}.masteryStatGrants`),
    evolutionTypeGraft: graft as TypeId | null,
    classId: classId as PassiveId | null,
  };
}

function decodeMap(value: unknown): RunMap {
  if (!isObject(value)) reject('map is not an object');
  if (typeof value.seed !== 'number' || !Number.isFinite(value.seed)) reject('map.seed is not a number');
  if (!isObject(value.nodes)) reject('map.nodes is not an object');

  const nodes: Record<string, MapNode> = {};
  for (const [id, raw] of Object.entries(value.nodes)) {
    if (!isObject(raw)) reject(`map.nodes.${id} is not an object`);
    if (raw.id !== id) reject(`map.nodes.${id} is keyed under a different id`);
    if (typeof raw.type !== 'string' || !NODE_TYPES.has(raw.type)) reject(`map.nodes.${id} has unknown type "${String(raw.type)}"`);
    if (!isInt(raw.row, 0)) reject(`map.nodes.${id}.row is not a row`);
    if (!isInt(raw.col, 0)) reject(`map.nodes.${id}.col is not a column`);
    if (!isStringArray(raw.nextIds)) reject(`map.nodes.${id}.nextIds is not a list of ids`);
    nodes[id] = { id, type: raw.type as MapNodeType, row: raw.row, col: raw.col, nextIds: [...raw.nextIds] };
  }

  if (!Array.isArray(value.rows) || !value.rows.every(isStringArray)) reject('map.rows is not a list of rows');
  if (!isStringArray(value.startNodeIds)) reject('map.startNodeIds is not a list of ids');
  if (typeof value.bossNodeId !== 'string') reject('map.bossNodeId is missing');

  // Referential integrity: a dangling edge strands the player on a map with no legal move.
  const known = new Set(Object.keys(nodes));
  for (const node of Object.values(nodes)) {
    for (const next of node.nextIds) if (!known.has(next)) reject(`map.nodes.${node.id} points at missing node "${next}"`);
  }
  const rows = (value.rows as string[][]).map((row) => {
    for (const id of row) if (!known.has(id)) reject(`map.rows names missing node "${id}"`);
    return [...row];
  });
  for (const id of value.startNodeIds) if (!known.has(id)) reject(`map.startNodeIds names missing node "${id}"`);
  if (!known.has(value.bossNodeId)) reject(`map.bossNodeId names missing node "${value.bossNodeId}"`);

  return { seed: value.seed, nodes, rows, startNodeIds: [...value.startNodeIds], bossNodeId: value.bossNodeId };
}

/** The Pact Seal's filled sockets, and the finale's enemy side (docs/lore.md §6). */
function decodeBrokenSeals(value: unknown, index: SaveContentIndex): BrokenSeal[] {
  if (!Array.isArray(value)) reject('run.brokenSeals is not a list');

  const seals: BrokenSeal[] = [];
  const seenActs = new Set<number>();
  value.forEach((entry, at) => {
    const label = `brokenSeals[${at}]`;
    if (!isObject(entry)) reject(`${label} is not an object`);
    if (!isInt(entry.actNumber, 1, TOTAL_ACTS)) reject(`${label}.actNumber is not an act in 1-${TOTAL_ACTS}`);
    if (seenActs.has(entry.actNumber)) reject(`${label} repeats act ${entry.actNumber}`);
    seenActs.add(entry.actNumber);
    if (typeof entry.locationId !== 'string' || !index.locationIds.has(entry.locationId)) {
      reject(`${label} references unknown location "${String(entry.locationId)}"`);
    }
    if (typeof entry.championId !== 'string' || !index.championIds.has(entry.championId)) {
      reject(`${label} references unknown champion "${String(entry.championId)}"`);
    }
    if (!isInt(entry.level, 1)) reject(`${label}.level is not a level`);
    seals.push({
      actNumber: entry.actNumber,
      locationId: entry.locationId,
      championId: entry.championId,
      level: entry.level,
      statGrants: decodeStatGrants(entry.statGrants, `${label}.statGrants`),
    });
  });
  return seals.sort((a, b) => a.actNumber - b.actNumber);
}

function decodeRun(value: unknown, index: SaveContentIndex): RunState {
  if (!isObject(value)) reject('run is not an object');
  if (!Array.isArray(value.roster)) reject('run.roster is not a list');
  if (value.roster.length > ROSTER_CAP) reject(`run.roster holds ${value.roster.length} heroes, over the ${ROSTER_CAP} cap`);

  const roster = value.roster.map((entry, at) => decodeRosterEntry(entry, index, at));
  const seen = new Set<string>();
  for (const entry of roster) {
    if (seen.has(entry.rosterId)) reject(`run.roster repeats rosterId "${entry.rosterId}"`);
    seen.add(entry.rosterId);
  }

  if (!isInt(value.levelUpPool, 0)) reject('run.levelUpPool is not a count');
  if (typeof value.levelUpDeferred !== 'boolean') reject('run.levelUpDeferred is not a flag');
  if (!isInt(value.gold, 0)) reject('run.gold is not a count');
  if (!isInt(value.recruitContracts, 0)) reject('run.recruitContracts is not a count');
  if (!isInt(value.fightsStarted, 0)) reject('run.fightsStarted is not a count');
  if (!isInt(value.encountersWon, 0)) reject('run.encountersWon is not a count');
  if (!isInt(value.actNumber, 1, TOTAL_ACTS)) reject(`run.actNumber is not an act in 1-${TOTAL_ACTS}`);

  // A checkpoint is only ever written from the map or an act intro, both of which have one.
  if (value.map === null || value.map === undefined) reject('run.map is missing');
  const map = decodeMap(value.map);

  const currentNodeId = value.currentNodeId ?? null;
  if (currentNodeId !== null) {
    if (typeof currentNodeId !== 'string') reject('run.currentNodeId is not an id');
    if (!map.nodes[currentNodeId]) reject(`run.currentNodeId names missing node "${currentNodeId}"`);
  }

  if (!isStringArray(value.visitedNodeIds)) reject('run.visitedNodeIds is not a list of ids');
  for (const id of value.visitedNodeIds) if (!map.nodes[id]) reject(`run.visitedNodeIds names missing node "${id}"`);

  return {
    roster,
    levelUpPool: value.levelUpPool,
    levelUpDeferred: value.levelUpDeferred,
    gold: value.gold,
    relics: requireIds(value.relics, index.relicIds, 'run.relics'),
    recruitContracts: value.recruitContracts,
    map,
    currentNodeId,
    visitedNodeIds: [...value.visitedNodeIds],
    fightsStarted: value.fightsStarted,
    encountersWon: value.encountersWon,
    actNumber: value.actNumber,
    locationIds: requireIds(value.locationIds, index.locationIds, 'run.locationIds'),
    brokenSeals: decodeBrokenSeals(value.brokenSeals, index),
  };
}

/**
 * Validates and REBUILDS the save rather than casting the parsed blob, so nothing a
 * hand-edited file smuggled in reaches the run.
 */
export function decodeSave(raw: unknown, index: SaveContentIndex): LoadResult {
  try {
    if (!isObject(raw)) reject('save is not an object');
    if (raw.version !== SAVE_VERSION) reject(`save is version ${String(raw.version)}, this build reads ${SAVE_VERSION}`);
    if (raw.checkpoint !== 'map' && raw.checkpoint !== 'actIntro') reject(`save has unknown checkpoint "${String(raw.checkpoint)}"`);
    const savedAt = isInt(raw.savedAt, 0) ? raw.savedAt : 0;
    return { ok: true, save: { version: SAVE_VERSION, savedAt, checkpoint: raw.checkpoint, run: decodeRun(raw.run, index) } };
  } catch (err) {
    if (err instanceof Rejected) return { ok: false, reason: err.message };
    throw err;
  }
}
