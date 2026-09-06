import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition, StatKey } from '../../engine/content';
import { MAX_ITEM_SLOTS, type EquipmentDefinition, type EquipmentLoadout } from '../../run/equipment';
import type { EvolutionNode, ProgressionTable } from '../../run/progression';
import { MOVE_CAP } from '../../run/progression';
import { ROSTER_CAP } from '../../run/state';
import {
  createSandboxHeroConfig,
  freshSandboxRosterId,
  listSandboxPresetNames,
  loadSandboxPreset,
  saveSandboxPreset,
  deleteSandboxPreset,
  type SandboxHeroConfig,
  type SandboxSideConfig,
} from '../../run/sandbox';
import { getTypeColor } from '../combat/typeColors';
import { MoveTile } from '../shared/MoveTile';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { STAT_ORDER, StatGlyph } from '../shared/StatBars';

type SideKey = 'A' | 'B';

const HERO_LIST = Object.values(heroes).sort((a, b) => a.name.localeCompare(b.name));

// Uncategorised, so every slot picker offers the whole catalog.
const EQUIPMENT_LIST: EquipmentDefinition[] = Object.values(equipment);

/**
 * Sets slot `index` of a sandbox loadout. The list is compact, so a select on an empty slot
 * appends and clearing one closes the gap — the pickers below it shift up, which is what the
 * dev tool wants over a sparse list full of holes.
 */
function setSandboxItem(loadout: EquipmentLoadout, index: number, itemId: string | null): EquipmentLoadout {
  const next = [...loadout];
  if (itemId === null) next.splice(index, 1);
  else if (index >= next.length) next.push(itemId);
  else next[index] = itemId;
  return next.filter((id, i) => next.indexOf(id) === i);
}

function displayTypesFor(hero: HeroDefinition, config: SandboxHeroConfig, table: ProgressionTable): readonly string[] {
  if (!config.pathId) return hero.types;
  const node = table.evolutions[hero.id]?.[0];
  const path = node?.paths.find((p) => p.id === config.pathId);
  return path?.typeGraft ? [...hero.types, path.typeGraft] : hero.types;
}

interface HeroConfigCardProps {
  hero: HeroDefinition;
  config: SandboxHeroConfig;
  isActive: boolean;
  movePool: string[];
  evolutionNode: EvolutionNode | null;
  onLevelChange: (level: number) => void;
  onToggleActive: () => void;
  onRemove: () => void;
  onToggleMove: (moveId: string) => void;
  onEquipChange: (index: number, itemId: string | null) => void;
  onPathChange: (pathId: string | null) => void;
  onBonusStatChange: (stat: StatKey, amount: number) => void;
}

function HeroConfigCard({
  hero,
  config,
  isActive,
  movePool,
  evolutionNode,
  onLevelChange,
  onToggleActive,
  onRemove,
  onToggleMove,
  onEquipChange,
  onPathChange,
  onBonusStatChange,
}: HeroConfigCardProps) {
  const displayTypes = displayTypesFor(hero, config, progressionTable);
  return (
    <div className={`sandbox-hero-card${isActive ? ' active' : ''}`} style={{ borderLeftColor: getTypeColor(hero.types[0]) }}>
      <div className="sandbox-hero-head">
        <HeroPortrait heroId={hero.id} className="training-hero-portrait" />
        <div className="training-hero-name-block">
          <div className="training-hero-name-row">
            <h3>{hero.name}</h3>
            <div className="sandbox-level-stepper">
              <button type="button" onClick={() => onLevelChange(Math.max(1, config.level - 1))} aria-label="Level down">
                −
              </button>
              <span>Lv {config.level}</span>
              <button type="button" onClick={() => onLevelChange(config.level + 1)} aria-label="Level up">
                +
              </button>
            </div>
          </div>
          <div className="training-hero-types">
            {displayTypes.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
        <button type="button" className={`sandbox-active-toggle${isActive ? ' active' : ''}`} onClick={onToggleActive}>
          {isActive ? 'Active' : 'Bench'}
        </button>
        <button type="button" className="sandbox-remove-button" onClick={onRemove} aria-label={`Remove ${hero.name}`}>
          ✕
        </button>
      </div>

      <div className="sandbox-section-label">
        Moves ({config.moveIds.length}/{MOVE_CAP})
      </div>
      <div className="move-tile-row">
        {movePool.map((moveId) =>
          moves[moveId] ? (
            <MoveTile key={moveId} move={moves[moveId]} selected={config.moveIds.includes(moveId)} onClick={() => onToggleMove(moveId)} />
          ) : null
        )}
      </div>

      {/* The sandbox ignores the hero's own slot count and offers all MAX_ITEM_SLOTS: it exists to
          test builds the run cannot hand you yet. */}
      <div className="sandbox-section-label">Items</div>
      <div className="sandbox-equip-row">
        {Array.from({ length: MAX_ITEM_SLOTS }, (_, index) => (
          <label key={index} className="sandbox-equip-select">
            <span>Slot {index + 1}</span>
            <select value={config.equipment[index] ?? ''} onChange={(e) => onEquipChange(index, e.target.value || null)}>
              <option value="">— empty —</option>
              {EQUIPMENT_LIST.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {evolutionNode && (
        <>
          <div className="sandbox-section-label">Evolution</div>
          <select value={config.pathId ?? ''} onChange={(e) => onPathChange(e.target.value || null)}>
            <option value="">— none (mono) —</option>
            {evolutionNode.paths.map((path) => (
              <option key={path.id} value={path.id}>
                {path.name} ({path.kind})
              </option>
            ))}
          </select>
        </>
      )}

      <div className="sandbox-section-label">Bonus stats</div>
      <div className="sandbox-bonus-stat-row">
        {STAT_ORDER.map((stat) => (
          <label key={stat} className="sandbox-bonus-stat" title={stat}>
            <StatGlyph stat={stat} />
            <input
              type="number"
              step={5}
              value={config.bonusStatGrants[stat] ?? 0}
              onChange={(e) => onBonusStatChange(stat, Math.round((Number(e.target.value) || 0) / 5) * 5)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

interface Props {
  sideA: SandboxSideConfig;
  sideB: SandboxSideConfig;
  onChangeSideA: (next: SandboxSideConfig | ((prev: SandboxSideConfig) => SandboxSideConfig)) => void;
  onChangeSideB: (next: SandboxSideConfig | ((prev: SandboxSideConfig) => SandboxSideConfig)) => void;
  onStartFight: (a: SandboxSideConfig, b: SandboxSideConfig) => void;
  onClose: () => void;
}

// Permanent team-builder tool. Relics are Side A only. Side state lives in
// App.tsx because this component unmounts while the sandbox fight runs.
export function SandboxBattleScreen({ sideA, sideB, onChangeSideA, onChangeSideB, onStartFight, onClose }: Props) {
  const [tab, setTab] = useState<SideKey>('A');
  const [addHeroId, setAddHeroId] = useState('');
  const [presetNames, setPresetNames] = useState<string[]>(() => listSandboxPresetNames());
  const [presetNameInput, setPresetNameInput] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  const side = tab === 'A' ? sideA : sideB;

  function updateSide(target: SideKey, fn: (s: SandboxSideConfig) => SandboxSideConfig) {
    (target === 'A' ? onChangeSideA : onChangeSideB)(fn);
  }

  function updateHero(target: SideKey, rosterId: string, fn: (h: SandboxHeroConfig) => SandboxHeroConfig) {
    updateSide(target, (s) => ({ ...s, heroes: s.heroes.map((h) => (h.rosterId === rosterId ? fn(h) : h)) }));
  }

  function addHero(target: SideKey, heroId: string) {
    const hero = heroes[heroId];
    if (!hero) return;
    updateSide(target, (s) => {
      if (s.heroes.length >= ROSTER_CAP) return s;
      const rosterId = freshSandboxRosterId(s.heroes, heroId);
      const hc = createSandboxHeroConfig(rosterId, hero);
      const activeIds: [string | null, string | null] = [...s.activeIds];
      if (activeIds[0] === null) activeIds[0] = rosterId;
      else if (activeIds[1] === null) activeIds[1] = rosterId;
      return { ...s, heroes: [...s.heroes, hc], activeIds };
    });
  }

  function removeHero(target: SideKey, rosterId: string) {
    updateSide(target, (s) => ({
      ...s,
      heroes: s.heroes.filter((h) => h.rosterId !== rosterId),
      activeIds: s.activeIds.map((id) => (id === rosterId ? null : id)) as [string | null, string | null],
    }));
  }

  function toggleActive(target: SideKey, rosterId: string) {
    updateSide(target, (s) => {
      if (s.activeIds.includes(rosterId)) {
        return { ...s, activeIds: s.activeIds.map((id) => (id === rosterId ? null : id)) as [string | null, string | null] };
      }
      const slot = s.activeIds[0] === null ? 0 : s.activeIds[1] === null ? 1 : null;
      if (slot === null) return s;
      const next: [string | null, string | null] = [...s.activeIds];
      next[slot] = rosterId;
      return { ...s, activeIds: next };
    });
  }

  function toggleMove(target: SideKey, rosterId: string, moveId: string) {
    updateHero(target, rosterId, (h) => {
      if (h.moveIds.includes(moveId)) return { ...h, moveIds: h.moveIds.filter((id) => id !== moveId) };
      if (h.moveIds.length >= MOVE_CAP) return h;
      return { ...h, moveIds: [...h.moveIds, moveId] };
    });
  }

  function toggleRelic(relicId: string) {
    onChangeSideA((s) => ({
      ...s,
      relicIds: s.relicIds.includes(relicId) ? s.relicIds.filter((id) => id !== relicId) : [...s.relicIds, relicId],
    }));
  }

  function handleSavePreset() {
    const name = presetNameInput.trim();
    if (!name) return;
    saveSandboxPreset(name, sideA, sideB);
    setPresetNames(listSandboxPresetNames());
    setSelectedPreset(name);
    setPresetNameInput('');
  }

  function handleLoadPreset() {
    if (!selectedPreset) return;
    const preset = loadSandboxPreset(selectedPreset);
    if (!preset) return;
    onChangeSideA(preset.a);
    onChangeSideB(preset.b);
  }

  function handleDeletePreset() {
    if (!selectedPreset) return;
    deleteSandboxPreset(selectedPreset);
    setPresetNames(listSandboxPresetNames());
    setSelectedPreset('');
  }

  const canStart = sideA.activeIds.some(Boolean) && sideB.activeIds.some(Boolean);

  return (
    <div className="node-screen sandbox-screen">
      <div className="sandbox-header">
        <h2>Sandbox Battle</h2>
        <button className="log-close-button" onClick={onClose} aria-label="Back to title">
          ✕
        </button>
      </div>

      <div className="sandbox-tabs">
        <button type="button" className={`sandbox-tab${tab === 'A' ? ' active' : ''}`} onClick={() => setTab('A')}>
          Side A ({sideA.heroes.length})
        </button>
        <button type="button" className={`sandbox-tab${tab === 'B' ? ' active' : ''}`} onClick={() => setTab('B')}>
          Side B ({sideB.heroes.length})
        </button>
      </div>

      <div className="screen-scroll">
        <div className="sandbox-add-row">
          <select value={addHeroId} onChange={(e) => setAddHeroId(e.target.value)}>
            <option value="">Add a hero…</option>
            {HERO_LIST.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary-button"
            disabled={!addHeroId || side.heroes.length >= ROSTER_CAP}
            onClick={() => {
              addHero(tab, addHeroId);
              setAddHeroId('');
            }}
          >
            Add
          </button>
        </div>

        <div className="sandbox-hero-list">
          {side.heroes.map((config) => {
            const hero = heroes[config.heroId];
            if (!hero) return null;
            const evolutionNode = progressionTable.evolutions[hero.id]?.[0] ?? null;
            const movePool = [...new Set([...hero.moveIds, ...(progressionTable.moveTiers[hero.id] ?? [])])];
            return (
              <HeroConfigCard
                key={config.rosterId}
                hero={hero}
                config={config}
                isActive={side.activeIds.includes(config.rosterId)}
                movePool={movePool}
                evolutionNode={evolutionNode}
                onLevelChange={(level) => updateHero(tab, config.rosterId, (h) => ({ ...h, level }))}
                onToggleActive={() => toggleActive(tab, config.rosterId)}
                onRemove={() => removeHero(tab, config.rosterId)}
                onToggleMove={(moveId) => toggleMove(tab, config.rosterId, moveId)}
                onEquipChange={(index, itemId) =>
                  updateHero(tab, config.rosterId, (h) => ({ ...h, equipment: setSandboxItem(h.equipment, index, itemId) }))
                }
                onPathChange={(pathId) => updateHero(tab, config.rosterId, (h) => ({ ...h, pathId }))}
                onBonusStatChange={(stat, amount) =>
                  updateHero(tab, config.rosterId, (h) => ({ ...h, bonusStatGrants: { ...h.bonusStatGrants, [stat]: amount } }))
                }
              />
            );
          })}
          {side.heroes.length === 0 && <div className="sandbox-empty-hint">No heroes yet — add one above.</div>}
        </div>

        {tab === 'A' && (
          <>
            <div className="sandbox-section-label">Team relics (Side A only)</div>
            <div className="sandbox-relic-row">
              {Object.values(relics).map((relic) => (
                <button
                  key={relic.id}
                  type="button"
                  className={`sandbox-relic-chip${sideA.relicIds.includes(relic.id) ? ' selected' : ''}`}
                  onClick={() => toggleRelic(relic.id)}
                  title={relic.description}
                >
                  {relic.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="sandbox-section-label">Presets</div>
        <div className="sandbox-preset-row">
          <input
            className="sandbox-preset-input"
            placeholder="Preset name"
            value={presetNameInput}
            onChange={(e) => setPresetNameInput(e.target.value)}
          />
          <button type="button" className="secondary-button" disabled={!presetNameInput.trim()} onClick={handleSavePreset}>
            Save
          </button>
        </div>
        {presetNames.length > 0 && (
          <div className="sandbox-preset-row">
            <select value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}>
              <option value="">Load a preset…</option>
              {presetNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button type="button" className="secondary-button" disabled={!selectedPreset} onClick={handleLoadPreset}>
              Load
            </button>
            <button type="button" className="secondary-button" disabled={!selectedPreset} onClick={handleDeletePreset}>
              Delete
            </button>
          </div>
        )}
      </div>

      <button className="resolve-button" disabled={!canStart} onClick={() => onStartFight(sideA, sideB)}>
        {canStart ? 'Start Fight' : 'Both sides need an active hero'}
      </button>
    </div>
  );
}
