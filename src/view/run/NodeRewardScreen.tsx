import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import type { StatKey } from '../../engine/content';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition, EquipmentSlot } from '../../run/equipment';
import { grantCurrencyReward, grantUpgradeReward, grantRelicReward, grantContractReward, applyEquipmentReward } from '../../run/runProgress';

export type RewardNodeType = 'currencyReward' | 'upgradeReward' | 'equipmentReward' | 'relicReward' | 'contractReward';

interface Props {
  nodeType: RewardNodeType;
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
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

const EQUIP_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
};

/** "+10 Attack, +20 HP" — the benefit preview shown on hover/click before committing to an equipment choice. */
function fmtStatGrants(grants: Partial<Record<StatKey, number>>): string {
  const parts = Object.entries(grants)
    .filter(([, amount]) => amount)
    .map(([stat, amount]) => `${(amount as number) > 0 ? '+' : ''}${amount} ${STAT_LABELS[stat as StatKey] ?? stat}`);
  return parts.length > 0 ? parts.join(', ') : 'No stat grants';
}

/**
 * Resolves the four "instant" reward node types (docs/run-loop.md): currency
 * and upgrade grant on a single tap; equipment and relic offer 3 choices.
 * Equipment additionally asks which roster hero to equip it onto (via the
 * existing equipItem, through runProgress.ts's applyEquipmentReward) — there
 * is no unequipped-item inventory in this pass, so the choice is immediate.
 */
export function NodeRewardScreen({ nodeType, run, onRunChange, onContinue }: Props) {
  const [currencyAmount] = useState(() => 15 + Math.floor(Math.random() * 16)); // 15-30
  const [upgradeAmount] = useState(() => 2 + Math.floor(Math.random() * 2)); // 2-3
  const [equipmentChoices] = useState<EquipmentDefinition[]>(() => (nodeType === 'equipmentReward' ? pickRandom(Object.values(equipment), 3) : []));
  const [relicChoices] = useState(() =>
    nodeType === 'relicReward' ? pickRandom(Object.values(relics).filter((r) => !run.relics.includes(r.id)), 3) : []
  );

  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [chosenItem, setChosenItem] = useState<EquipmentDefinition | null>(null);
  const [previewRosterId, setPreviewRosterId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  function handleClaimInstant(next: RunState) {
    onRunChange(next);
    setClaimed(true);
  }

  function handleAssignEquipment(rosterId: string) {
    if (!chosenItem) return;
    onRunChange(applyEquipmentReward(run, rosterId, chosenItem));
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
          <div className="reward-panel">
            <h2>🛡️ Equipment Cache</h2>
            {!chosenItem ? (
              <>
                <p className="hint">Tap an item to preview what it grants.</p>
                <div className="roster-grid">
                  {equipmentChoices.map((item) => {
                    const isPreviewing = previewItemId === item.id;
                    return (
                      <button
                        key={item.id}
                        className={`roster-card${isPreviewing ? ' picked' : ''}`}
                        onClick={() => setPreviewItemId(isPreviewing ? null : item.id)}
                      >
                        <div className="roster-card-name">{item.name}</div>
                        <div className="roster-card-types">{EQUIP_SLOT_LABELS[item.slot]}</div>
                        {isPreviewing && <div className="hint">{fmtStatGrants(item.statGrants)}</div>}
                      </button>
                    );
                  })}
                </div>
                {previewItemId && (
                  <button
                    className="resolve-button"
                    onClick={() => setChosenItem(equipmentChoices.find((i) => i.id === previewItemId) ?? null)}
                  >
                    Confirm {equipmentChoices.find((i) => i.id === previewItemId)?.name}
                  </button>
                )}
              </>
            ) : !claimed ? (
              <>
                <p className="hint">
                  Equip {chosenItem.name} ({fmtStatGrants(chosenItem.statGrants)}) on — tap a hero to preview, then confirm:
                </p>
                <div className="roster-grid">
                  {run.roster.map((entry) => {
                    const currentId = entry.equipment[chosenItem.slot];
                    const currentItem = currentId ? equipment[currentId] : null;
                    const isPreviewing = previewRosterId === entry.rosterId;
                    return (
                      <button
                        key={entry.rosterId}
                        className={`roster-card${isPreviewing ? ' picked' : ''}`}
                        onClick={() => setPreviewRosterId(isPreviewing ? null : entry.rosterId)}
                      >
                        <div className="roster-card-name">{heroes[entry.heroId].name}</div>
                        <div className="roster-card-types">{currentItem ? `replaces ${currentItem.name}` : 'empty slot'}</div>
                        {isPreviewing && currentItem && <div className="hint">Losing: {fmtStatGrants(currentItem.statGrants)}</div>}
                      </button>
                    );
                  })}
                </div>
                <div className="training-row">
                  {previewRosterId && (
                    <button className="resolve-button" onClick={() => handleAssignEquipment(previewRosterId)}>
                      Confirm Equip
                    </button>
                  )}
                  <button
                    className="log-toggle-button"
                    onClick={() => {
                      setChosenItem(null);
                      setPreviewItemId(null);
                      setPreviewRosterId(null);
                    }}
                  >
                    ← Back
                  </button>
                </div>
              </>
            ) : (
              <p className="hint">{chosenItem.name} equipped.</p>
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
      <button className="resolve-button" disabled={!canContinue} onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
