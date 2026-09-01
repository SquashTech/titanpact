// Sandbox Battle (dev/design tool): hand-assembled rosters dropped into the
// real FightScreen. Builds throwaway RunState/Squad pairs only.

import type { HeroDefinition, StatKey } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { createRosterEntry, addRosterEntry, createRunState, type RunState } from './state';
import type { Squad } from './squad';
import { createEmptyLoadout, type EquipmentLoadout } from './equipment';
import { chooseEvolutionPath, EVOLUTION_LEVEL, type ProgressionTable } from './progression';

export interface SandboxHeroConfig {
  rosterId: string;
  heroId: string;
  level: number;
  moveIds: string[];
  /** Applied regardless of `level` — see buildSandboxSide. */
  pathId: string | null;
  equipment: EquipmentLoadout;
  bonusStatGrants: Partial<Record<StatKey, number>>;
}

export interface SandboxSideConfig {
  heroes: SandboxHeroConfig[];
  /** Up to 2 active rosterIds; the rest start benched. */
  activeIds: [string | null, string | null];
  /** Side A only; no enemy-relic support. */
  relicIds: string[];
}

let nextRosterSuffix = 1;

export function freshSandboxRosterId(existing: readonly SandboxHeroConfig[], heroId: string): string {
  if (!existing.some((h) => h.rosterId === heroId)) return heroId;
  return `${heroId}-${nextRosterSuffix++}`;
}

export function createSandboxHeroConfig(rosterId: string, hero: HeroDefinition): SandboxHeroConfig {
  return {
    rosterId,
    heroId: hero.id,
    level: 1,
    moveIds: [...hero.moveIds],
    pathId: null,
    equipment: createEmptyLoadout(),
    bonusStatGrants: {},
  };
}

export function createEmptySandboxSide(): SandboxSideConfig {
  return { heroes: [], activeIds: [null, null], relicIds: [] };
}

/** The level gate on Evolution is ignored here: level is bumped to EVOLUTION_LEVEL just long enough to reuse chooseEvolutionPath's validation, then restored. */
export function buildSandboxSide(config: SandboxSideConfig, heroes: HeroLookup, table: ProgressionTable): { run: RunState; squad: Squad } {
  let run = createRunState(0, 0);

  for (const hc of config.heroes) {
    const base = createRosterEntry(hc.rosterId, hc.heroId, hc.moveIds);
    run = addRosterEntry(run, { ...base, level: hc.level, equipment: hc.equipment, bonusStatGrants: hc.bonusStatGrants });

    if (hc.pathId) {
      run = {
        ...run,
        roster: run.roster.map((r) => (r.rosterId === hc.rosterId ? { ...r, level: Math.max(r.level, EVOLUTION_LEVEL) } : r)),
      };
      try {
        run = chooseEvolutionPath(run, table, heroes, hc.rosterId, hc.pathId);
      } catch {
        // Invalid path for this hero — leave it un-evolved so a bad preset can't crash the builder.
      }
      run = { ...run, roster: run.roster.map((r) => (r.rosterId === hc.rosterId ? { ...r, level: hc.level } : r)) };
    }
  }

  const benchIds = config.heroes.map((h) => h.rosterId).filter((id) => id !== config.activeIds[0] && id !== config.activeIds[1]);
  return { run, squad: { activeIds: config.activeIds, benchIds } };
}

// --- Preset save/load (localStorage, plain JSON) ---

export interface SandboxPreset {
  name: string;
  a: SandboxSideConfig;
  b: SandboxSideConfig;
}

const STORAGE_KEY = 'titanpact.sandboxPresets';

function readPresets(): Record<string, SandboxPreset> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writePresets(presets: Record<string, SandboxPreset>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function saveSandboxPreset(name: string, a: SandboxSideConfig, b: SandboxSideConfig): void {
  const presets = readPresets();
  presets[name] = { name, a, b };
  writePresets(presets);
}

export function listSandboxPresetNames(): string[] {
  return Object.keys(readPresets()).sort();
}

export function loadSandboxPreset(name: string): SandboxPreset | null {
  return readPresets()[name] ?? null;
}

export function deleteSandboxPreset(name: string): void {
  const presets = readPresets();
  delete presets[name];
  writePresets(presets);
}
