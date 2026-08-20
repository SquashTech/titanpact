// Sandbox Battle (dev/design tool, not a run-tier mechanic): lets the user
// hand-assemble two full rosters — level, moves, equipment, evolution path,
// bonus stats, team relics — and drop straight into the real FightScreen.
// Replaces one-off hardcoded test-encounter functions (App.tsx
// createConditionsTestEncounter et al.) with a reusable, data-driven builder.
// This module only builds throwaway RunState/Squad pairs from a config; it
// never touches a real run's state.

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
  /** Chosen Evolution path id, or null for not-yet-evolved. Applied regardless of `level` — see buildSandboxSide. */
  pathId: string | null;
  equipment: EquipmentLoadout;
  bonusStatGrants: Partial<Record<StatKey, number>>;
}

export interface SandboxSideConfig {
  heroes: SandboxHeroConfig[];
  /** Up to 2 active rosterIds; the rest of `heroes` starts benched. */
  activeIds: [string | null, string | null];
  /** Team-wide relic ids — Side A (player) only; Sandbox Battle has no enemy-relic support. */
  relicIds: string[];
}

let nextRosterSuffix = 1;

/** A rosterId that won't collide with an already-added hero on the same side, even for repeated picks of the same hero. */
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

/**
 * Turns a SandboxSideConfig into a throwaway RunState + Squad, the same
 * inputs buildCombatState.ts already expects — hand-assembled the same way
 * App.tsx's createConditionsTestEncounter builds one, just parameterized by
 * UI-driven config instead of hardcoded per-scenario.
 *
 * Evolution paths are gated in real play by hero level
 * (progression.ts availableEvolution), which Sandbox Battle deliberately
 * ignores — the level a user sets is a display/stat-testing choice, not a
 * gate. To reuse chooseEvolutionPath's validation as-is (rather than forking
 * it), the entry's level is bumped to EVOLUTION_LEVEL just long enough to
 * pass the gate, then restored to whatever the user actually chose.
 */
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
        // Invalid/unavailable path for this hero — leave it un-evolved rather than throw, so a bad preset can't crash the builder.
      }
      run = { ...run, roster: run.roster.map((r) => (r.rosterId === hc.rosterId ? { ...r, level: hc.level } : r)) };
    }
  }

  const benchIds = config.heroes.map((h) => h.rosterId).filter((id) => id !== config.activeIds[0] && id !== config.activeIds[1]);
  return { run, squad: { activeIds: config.activeIds, benchIds } };
}

// --- Preset save/load (localStorage, plain JSON — no engine types involved) ---

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
