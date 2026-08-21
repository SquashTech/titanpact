import { useState, type CSSProperties } from 'react';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import type { StatKey } from '../../engine/content';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import type { RelicDefinition } from '../../run/relics';
import { pickWeightedEquipment } from '../../run/equipment';
import { grantCurrencyReward, grantUpgradeReward, grantRelicReward } from '../../run/runProgress';
import { EQUIP_SLOT_LABELS, EquipmentIcon, RARITY_COLOR_VARS, RARITY_LABELS, RelicIcon } from '../shared/EquipmentBox';
import { useLongPress } from '../shared/MoveTile';

export type RewardNodeType = 'currencyReward' | 'upgradeReward' | 'equipmentReward' | 'relicReward';

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

/** "+10 Attack, +20 HP" — the benefit preview shown on hover/click before committing to an equipment choice. */
function fmtStatGrants(grants: Partial<Record<StatKey, number>>): string {
  const parts = Object.entries(grants)
    .filter(([, amount]) => amount)
    .map(([stat, amount]) => `${(amount as number) > 0 ? '+' : ''}${amount} ${STAT_LABELS[stat as StatKey] ?? stat}`);
  return parts.length > 0 ? parts.join(', ') : 'No stat grants';
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

  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [pickedRelicId, setPickedRelicId] = useState<string | null>(null);
  const [previewRelicId, setPreviewRelicId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

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
    <div className="node-screen">
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

        {nodeType === 'equipmentReward' && (
          <div className="reward-panel equip-cache-panel bottom-pinned">
            <div className="equip-cache-banner">
              <div className="equip-cache-glow" aria-hidden="true" />
              <h2>🛡️ Equipment Cache</h2>
              <p className="hint">Tap a piece of gear to select it, then claim it — you'll choose who wears it next.</p>
            </div>
            <div className="equip-cache-list">
              {equipmentChoices.map((item) => {
                const isPreviewing = previewItemId === item.id;
                return (
                  <button
                    key={item.id}
                    className={`equip-cache-card${isPreviewing ? ' picked' : ''}`}
                    style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
                    onClick={() => setPreviewItemId(isPreviewing ? null : item.id)}
                  >
                    <EquipmentIcon item={item} slot={item.slot} className="equip-cache-card-icon" />
                    <div className="equip-cache-card-body">
                      <div className="equip-cache-card-name">{item.name}</div>
                      <div className="equip-cache-card-meta">
                        <span className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</span>
                        <span className="equip-cache-card-slot">{EQUIP_SLOT_LABELS[item.slot]}</span>
                      </div>
                      <div className="equip-cache-card-stats">{fmtStatGrants(item.statGrants)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {previewItemId && (
              <button className="resolve-button" onClick={() => onClaimEquipment(previewItemId)}>
                Claim {equipmentChoices.find((i) => i.id === previewItemId)?.name}
              </button>
            )}
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
    </div>
  );
}
