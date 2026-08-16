import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import type { RunState } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { grantCurrencyReward, grantUpgradeReward, grantRelicReward, applyEquipmentReward } from '../../run/runProgress';

export type RewardNodeType = 'currencyReward' | 'upgradeReward' | 'equipmentReward' | 'relicReward';

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

  const [chosenItem, setChosenItem] = useState<EquipmentDefinition | null>(null);
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

        {nodeType === 'equipmentReward' && (
          <div className="reward-panel">
            <h2>🛡️ Equipment Cache</h2>
            {!chosenItem ? (
              <div className="roster-grid">
                {equipmentChoices.map((item) => (
                  <button key={item.id} className="roster-card" onClick={() => setChosenItem(item)}>
                    <div className="roster-card-name">{item.name}</div>
                    <div className="roster-card-types">{item.slot}</div>
                  </button>
                ))}
              </div>
            ) : !claimed ? (
              <>
                <p className="hint">Equip {chosenItem.name} on:</p>
                <div className="roster-grid">
                  {run.roster.map((entry) => {
                    const currentId = entry.equipment[chosenItem.slot];
                    return (
                      <button key={entry.rosterId} className="roster-card" onClick={() => handleAssignEquipment(entry.rosterId)}>
                        <div className="roster-card-name">{heroes[entry.heroId].name}</div>
                        <div className="roster-card-types">{currentId ? `replaces ${equipment[currentId].name}` : 'empty slot'}</div>
                      </button>
                    );
                  })}
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
