import { useState, type CSSProperties } from 'react';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import type { StatKey } from '../../engine/content';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { pickWeightedEquipment } from '../../run/equipment';
import { grantCurrencyReward, grantUpgradeReward, grantRelicReward, grantContractReward } from '../../run/runProgress';
import { EQUIP_SLOT_ICONS, EQUIP_SLOT_LABELS, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';

export type RewardNodeType = 'currencyReward' | 'upgradeReward' | 'equipmentReward' | 'relicReward' | 'contractReward';

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

/**
 * Resolves the five "instant" reward node types (docs/run-loop.md): currency,
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
          <div className="reward-panel">
            <h2>💰 Gold Cache</h2>
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
          <div className="reward-panel">
            <h2>📈 Training Grounds</h2>
            {!claimed ? (
              <button className="resolve-button" onClick={() => handleClaimInstant(grantUpgradeReward(run, upgradeAmount))}>
                Claim {upgradeAmount} Training Points
              </button>
            ) : (
              <p className="hint">+{upgradeAmount} training points claimed.</p>
            )}
          </div>
        )}

        {nodeType === 'contractReward' && (
          <div className="reward-panel">
            <h2>📜 Contract Cache</h2>
            {!claimed ? (
              <button className="resolve-button" onClick={() => handleClaimInstant(grantContractReward(run, 1))}>
                Claim 1 Recruit Contract
              </button>
            ) : (
              <p className="hint">+1 Recruit Contract claimed.</p>
            )}
          </div>
        )}

        {nodeType === 'equipmentReward' && (
          <div className="reward-panel equip-cache-panel">
            <div className="equip-cache-banner">
              <div className="equip-cache-glow" aria-hidden="true" />
              <h2>🛡️ Equipment Cache</h2>
              <p className="hint">Tap a piece of gear to preview it, then claim it — you'll choose who wears it next.</p>
            </div>
            <div className="equip-cache-grid">
              {equipmentChoices.map((item) => {
                const isPreviewing = previewItemId === item.id;
                return (
                  <button
                    key={item.id}
                    className={`equip-cache-card${isPreviewing ? ' picked' : ''}`}
                    style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
                    onClick={() => setPreviewItemId(isPreviewing ? null : item.id)}
                  >
                    <span className="equip-cache-card-icon">{EQUIP_SLOT_ICONS[item.slot]}</span>
                    <div className="equip-cache-card-name">{item.name}</div>
                    <div className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</div>
                    <div className="equip-cache-card-slot">{EQUIP_SLOT_LABELS[item.slot]}</div>
                    {isPreviewing && <div className="hint">{fmtStatGrants(item.statGrants)}</div>}
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
          <div className="reward-panel">
            <h2>💠 Relic Shrine</h2>
            {!claimed ? (
              relicChoices.length > 0 ? (
                <div className="roster-grid">
                  {relicChoices.map((relic) => (
                    <button key={relic.id} className="roster-card" onClick={() => handleClaimRelic(relic.id)}>
                      <div className="roster-card-name">{relic.name}</div>
                      <div className="roster-card-types">{relic.description}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="hint">Every relic here is already yours.</p>
              )
            ) : (
              <p className="hint">Relic claimed.</p>
            )}
          </div>
        )}
      </div>
      {nodeType !== 'equipmentReward' && (
        <button className="resolve-button" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
      )}
    </div>
  );
}
