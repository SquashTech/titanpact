import { useEffect, useState, type CSSProperties } from 'react';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import { passives } from '../../data/passives';
import { statuses } from '../../data/statuses';
import type { StatKey } from '../../engine/content';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import type { RelicDefinition } from '../../run/relics';
import { pickWeightedEquipment } from '../../run/equipment';
import { grantCurrencyReward, grantUpgradeReward, grantRelicReward } from '../../run/runProgress';
import {
  EQUIP_SLOT_LABELS,
  EquipmentIcon,
  fmtGrant,
  RARITY_COLOR_VARS,
  RARITY_LABELS,
  RelicIcon,
} from '../shared/EquipmentBox';
import { STAT_ICONS } from '../shared/StatBars';
import { passiveEmoji } from '../shared/passiveIcons';
import { useLongPress } from '../shared/MoveTile';

export type RewardNodeType = 'currencyReward' | 'upgradeReward' | 'equipmentReward' | 'relicReward';

/** Equipment Cache chest-reveal timing (ms) — see `chestPhase` in NodeRewardScreen. */
const CHEST_SHAKE_MS = 900;
const CHEST_BURST_MS = 350;

interface Props {
  nodeType: RewardNodeType;
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
  /** equipmentReward only: claiming an item hands straight off to the forced-equip gate (App.tsx ForceEquipScreen) rather than resolving in place — there's no unequipped stash to claim into anymore. */
  onClaimEquipment: (itemId: string) => void;
}

function pickRandom<T>(pool: readonly T[], count: number): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
  }
  return picked;
}

const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  speed: 'Speed',
  manaPool: 'Mana Pool',
  mpRegen: 'MP Regen',
};

/**
 * "+10 Attack, +20 HP, Fire Force +10" — the one-line benefit preview on the
 * card face. Folds in passive/status grants (not just raw stats) so an item
 * like Ember Band — no statGrants, all its value is a granted status — never
 * reads as blank; the long-press popup below is where the full description
 * for each of those lives.
 */
function itemHighlights(item: EquipmentDefinition): string[] {
  const statParts = Object.entries(item.statGrants)
    .filter(([, amount]) => amount)
    .map(([stat, amount]) => `${(amount as number) > 0 ? '+' : ''}${amount} ${STAT_LABELS[stat as StatKey] ?? stat}`);
  const passiveParts = (item.grantsPassiveIds ?? []).flatMap((id) => (passives[id] ? [passives[id].name] : []));
  const statusParts = (item.grantsStatusIds ?? []).flatMap(({ statusId, magnitude }) =>
    statuses[statusId] ? [`${statuses[statusId].name} +${magnitude}`] : []
  );
  return [...statParts, ...passiveParts, ...statusParts];
}

interface RelicChoiceCardProps {
  relic: RelicDefinition;
  picked: boolean;
  onPick: () => void;
  onInspect: () => void;
}

/**
 * One relic offer on the Shrine screen. Tap selects it (highlighted, same
 * select-then-claim two-step as the Equipment Cache cards above); a ~500ms
 * hold instead opens the full description popup, matching the tap-picks/
 * hold-inspects split established by GuildHallPanel's relic cards
 * (`GuildHallRelicCard`) so relics read the same everywhere they're offered.
 * Pulled out of the .map() below because useLongPress is a hook.
 */
function RelicChoiceCard({ relic, picked, onPick, onInspect }: RelicChoiceCardProps) {
  const longPress = useLongPress(onInspect, onPick);
  return (
    <button className={`relic-card relic-shrine-card${picked ? ' picked' : ''}`} {...longPress}>
      <div className="relic-card-head">
        <RelicIcon relicId={relic.id} className="relic-card-icon" />
        <span className="relic-card-name">{relic.name}</span>
      </div>
    </button>
  );
}

interface EquipCacheCardProps {
  item: EquipmentDefinition;
  picked: boolean;
  onPick: () => void;
  onInspect: () => void;
  /** Staggers this card's fade-up-in behind the chest-reveal (see `chestPhase` in NodeRewardScreen). */
  revealDelayMs: number;
}

/**
 * One Equipment Cache offer card. Tap selects it (highlighted — the actual
 * claim happens via the resolve button below, mirroring RelicChoiceCard's
 * two-step); a ~500ms hold instead opens the full-detail popup, same
 * tap-picks/hold-inspects split as the relic cards so gear and relics read
 * the same everywhere an offer is made. Pulled out of the .map() below
 * because useLongPress is a hook.
 */
function EquipCacheCard({ item, picked, onPick, onInspect, revealDelayMs }: EquipCacheCardProps) {
  const longPress = useLongPress(onInspect, onPick);
  const highlights = itemHighlights(item);
  return (
    <button
      className={`equip-cache-card equip-cache-reveal-in${picked ? ' picked' : ''}`}
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity], animationDelay: `${revealDelayMs}ms` } as CSSProperties}
      {...longPress}
    >
      <div className="equip-cache-card-icon-badge">
        <EquipmentIcon item={item} slot={item.slot} className="equip-cache-card-icon" />
      </div>
      <div className="equip-cache-card-body">
        <div className="equip-cache-card-name">{item.name}</div>
        <div className="equip-cache-card-meta">
          <span className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</span>
          <span className="equip-cache-card-slot">{EQUIP_SLOT_LABELS[item.slot]}</span>
        </div>
        <div className="equip-cache-card-stats">{highlights.length > 0 ? highlights.join(' · ') : 'No effect'}</div>
      </div>
    </button>
  );
}

/**
 * Resolves the four "instant" reward node types (docs/run-loop.md): currency,
 * upgrade and equipment grant on a single tap; relic offers 3 choices.
 * Equipment claims hand off to `onClaimEquipment` (App.tsx routes that
 * through ForceEquipScreen) instead of resolving here — there's no
 * unequipped stash to claim into anymore, the player must place the item on
 * a hero or trash it before the run continues.
 */
export function NodeRewardScreen({ nodeType, run, onRunChange, onContinue, onClaimEquipment }: Props) {
  const [currencyAmount] = useState(() => 15 + Math.floor(Math.random() * 16)); // 15-30
  const [upgradeAmount] = useState(() => 2 + Math.floor(Math.random() * 2)); // 2-3
  const [equipmentChoices] = useState<EquipmentDefinition[]>(() =>
    nodeType === 'equipmentReward' ? pickWeightedEquipment(Object.values(equipment), 3) : []
  );
  const [relicChoices] = useState(() =>
    nodeType === 'relicReward' ? pickRandom(Object.values(relics).filter((r) => !run.relics.includes(r.id)), 3) : []
  );

  const [pickedItemId, setPickedItemId] = useState<string | null>(null);
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);
  const [pickedRelicId, setPickedRelicId] = useState<string | null>(null);
  const [previewRelicId, setPreviewRelicId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  /**
   * Equipment Cache only: a brief chest-opens-into-the-loot beat before the
   * offer cards appear, instead of dumping the picker on screen instantly.
   * `idle` shakes in anticipation, `opening` plays the burst-open keyframe,
   * `revealed` swaps in the real panel (whose banner/cards/button then
   * cascade in via their own `equip-cache-reveal-in` fade-up, staggered by
   * index in the equipmentChoices.map() below).
   */
  const [chestPhase, setChestPhase] = useState<'idle' | 'opening' | 'revealed'>(
    nodeType === 'equipmentReward' ? 'idle' : 'revealed'
  );

  useEffect(() => {
    if (nodeType !== 'equipmentReward') return;
    const openTimer = window.setTimeout(() => setChestPhase('opening'), CHEST_SHAKE_MS);
    const revealTimer = window.setTimeout(() => setChestPhase('revealed'), CHEST_SHAKE_MS + CHEST_BURST_MS);
    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(revealTimer);
    };
  }, [nodeType]);

  function handleClaimInstant(next: RunState) {
    onRunChange(next);
    setClaimed(true);
  }

  function handleClaimRelic(relicId: string) {
    onRunChange(grantRelicReward(run, relicId));
    setClaimed(true);
  }

  const canContinue = claimed || (nodeType === 'relicReward' && relicChoices.length === 0);

  return (
    <div className="node-screen node-reward-screen">
      <div className="screen-scroll">
        {nodeType === 'currencyReward' && (
          <div className="reward-panel bottom-pinned">
            <div className="equip-cache-banner">
              <div className="equip-cache-glow" aria-hidden="true" />
              <h2>💰 Gold Cache</h2>
              {!claimed && <p className="hint">A pile of gold, ready to claim.</p>}
            </div>
            {!claimed ? (
              <button className="resolve-button" onClick={() => handleClaimInstant(grantCurrencyReward(run, currencyAmount))}>
                Claim {currencyAmount}g
              </button>
            ) : (
              <p className="hint">+{currencyAmount}g claimed.</p>
            )}
          </div>
        )}

        {nodeType === 'upgradeReward' && (
          <div className="reward-panel bottom-pinned">
            <div className="equip-cache-banner">
              <div className="equip-cache-glow" aria-hidden="true" />
              <h2>⭐ XP Cache</h2>
              {!claimed && <p className="hint">Experience, ready to claim.</p>}
            </div>
            {!claimed ? (
              <button className="resolve-button" onClick={() => handleClaimInstant(grantUpgradeReward(run, upgradeAmount))}>
                Claim {upgradeAmount} XP
              </button>
            ) : (
              <p className="hint">+{upgradeAmount} XP claimed.</p>
            )}
          </div>
        )}

        {nodeType === 'equipmentReward' && chestPhase !== 'revealed' && (
          <div className="equip-cache-chest-screen">
            <div className="equip-cache-chest-reveal">
              <div className="equip-cache-chest-glow" aria-hidden="true" />
              <div className={`equip-cache-chest-icon${chestPhase === 'opening' ? ' opening' : ''}`}>🎁</div>
              <p className="hint">Opening the cache…</p>
            </div>
          </div>
        )}

        {nodeType === 'equipmentReward' && chestPhase === 'revealed' && (
          <div className="reward-panel equip-cache-panel bottom-pinned">
            <div className="equip-cache-banner equip-cache-reveal-in">
              <div className="equip-cache-glow" aria-hidden="true" />
              <h2>🎁 Equipment Cache</h2>
              <p className="hint">Tap a piece of gear to select it, hold to see full details, then claim it.</p>
            </div>
            <div className="equip-cache-list">
              {equipmentChoices.map((item, i) => (
                <EquipCacheCard
                  key={item.id}
                  item={item}
                  picked={pickedItemId === item.id}
                  onPick={() => setPickedItemId(pickedItemId === item.id ? null : item.id)}
                  onInspect={() => setInspectItemId(item.id)}
                  revealDelayMs={120 + i * 90}
                />
              ))}
            </div>
            <button
              className="resolve-button equip-cache-reveal-in"
              style={{ animationDelay: `${120 + equipmentChoices.length * 90}ms` } as CSSProperties}
              disabled={!pickedItemId}
              onClick={() => pickedItemId && onClaimEquipment(pickedItemId)}
            >
              {pickedItemId ? `Claim ${equipmentChoices.find((i) => i.id === pickedItemId)?.name}` : 'Select a piece of gear'}
            </button>
          </div>
        )}

        {nodeType === 'relicReward' && (
          <div className="reward-panel relic-shrine-panel bottom-pinned">
            <div className="relic-shrine-banner">
              <div className="relic-shrine-glow" aria-hidden="true" />
              <h2>💠 Relic Shrine</h2>
              {!claimed && relicChoices.length > 0 && (
                <p className="hint">Tap a relic to select it, hold to examine what it does.</p>
              )}
            </div>
            {!claimed ? (
              relicChoices.length > 0 ? (
                <div className="relic-shrine-list">
                  {relicChoices.map((relic) => (
                    <RelicChoiceCard
                      key={relic.id}
                      relic={relic}
                      picked={pickedRelicId === relic.id}
                      onPick={() => setPickedRelicId(pickedRelicId === relic.id ? null : relic.id)}
                      onInspect={() => setPreviewRelicId(relic.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="hint">Every relic here is already yours.</p>
              )
            ) : (
              <p className="hint">Relic claimed.</p>
            )}
            {pickedRelicId && !claimed && (
              <button className="resolve-button" onClick={() => handleClaimRelic(pickedRelicId)}>
                Claim {relicChoices.find((r) => r.id === pickedRelicId)?.name}
              </button>
            )}
          </div>
        )}
      </div>
      {nodeType !== 'equipmentReward' && (
        <button className="resolve-button" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
      )}

      {previewRelicId && (
        <div className="log-overlay" onClick={() => setPreviewRelicId(null)}>
          <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
            <div className="move-info-panel">
              <div className="move-info-head">
                <span className="move-info-name">{relics[previewRelicId].name}</span>
              </div>
              <div className="move-info-desc">{relics[previewRelicId].description ?? 'No effect described.'}</div>
            </div>
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}

      {inspectItemId &&
        (() => {
          const item = equipmentChoices.find((i) => i.id === inspectItemId);
          if (!item) return null;
          const grants = Object.entries(item.statGrants).filter(([, amount]) => amount) as [StatKey, number][];
          const grantedPassives = item.grantsPassiveIds ?? [];
          const grantedStatuses = item.grantsStatusIds ?? [];
          const hasEffects = grants.length > 0 || grantedPassives.length > 0 || grantedStatuses.length > 0;
          return (
            <div className="log-overlay" onClick={() => setInspectItemId(null)}>
              <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
                <div className="move-info-panel" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
                  <div className="move-info-head">
                    <span className="move-info-name">{item.name}</span>
                    <span className="move-info-kind">
                      {RARITY_LABELS[item.rarity]} · {EQUIP_SLOT_LABELS[item.slot]}
                    </span>
                  </div>
                  {grants.length > 0 && (
                    <div className="detail-modifier-list">
                      {grants.map(([stat, amount]) => (
                        <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                          {STAT_ICONS[stat]} {STAT_LABELS[stat]} {fmtGrant(amount)}
                        </span>
                      ))}
                    </div>
                  )}
                  {(grantedPassives.length > 0 || grantedStatuses.length > 0) && (
                    <div className="equip-spotlight-passives">
                      {grantedPassives.map((passiveId) => {
                        const def = passives[passiveId];
                        if (!def) return null;
                        return (
                          <div key={passiveId} className="equip-spotlight-passive">
                            <span className="equip-spotlight-passive-name">
                              {passiveEmoji[passiveId] ? `${passiveEmoji[passiveId]} ` : ''}
                              {def.name}
                            </span>
                            <span className="equip-spotlight-passive-desc">{def.description}</span>
                          </div>
                        );
                      })}
                      {grantedStatuses.map(({ statusId, magnitude }) => {
                        const def = statuses[statusId];
                        if (!def) return null;
                        return (
                          <div key={statusId} className="equip-spotlight-passive">
                            <span className="equip-spotlight-passive-name">
                              {def.name} +{magnitude}
                            </span>
                            <span className="equip-spotlight-passive-desc">{def.description}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!hasEffects && <div className="move-info-placeholder">No effects.</div>}
                </div>
                <div className="move-popup-hint">Tap anywhere to close</div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
