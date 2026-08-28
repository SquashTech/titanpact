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
import { StatGlyph } from '../shared/StatBars';
import { passiveEmoji } from '../shared/passiveIcons';
import { useLongPress } from '../shared/MoveTile';
import { ResourceMark, RunGlyph } from '../shared/RunGlyph';
import { NodeHeader, NodeSky, NODE_TINT_ARCANE, NODE_TINT_GOLD, NODE_TINT_VITAL } from '../shared/NodeStage';

export type RewardNodeType = 'currencyReward' | 'upgradeReward' | 'equipmentReward' | 'relicReward';

/** Each reward node keeps the hue it already wore as a banner — gold for the caches, XP green, the shrine's violet (see NodeStage). */
const NODE_TINT: Record<RewardNodeType, string> = {
  currencyReward: NODE_TINT_GOLD,
  upgradeReward: NODE_TINT_VITAL,
  equipmentReward: NODE_TINT_GOLD,
  relicReward: NODE_TINT_ARCANE,
};

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
  /** Staggers this card's fade-up-in behind the banner (see revealDelayMs usage below), same convention as EquipCacheCard. */
  revealDelayMs: number;
}

/**
 * One relic offer on the Shrine screen — a full-width row (icon + name +
 * the relic's actual description) rather than a square tile, so the player
 * can read exactly what each relic does before picking without holding
 * anything. Tap selects it (highlighted, same select-then-claim two-step as
 * the Equipment Cache cards above); no long-press/inspect step here since the
 * description is already on the card.
 */
function RelicChoiceCard({ relic, picked, onPick, revealDelayMs }: RelicChoiceCardProps) {
  return (
    <button
      className={`relic-card relic-shrine-card${picked ? ' picked' : ''}`}
      style={{ animationDelay: `${revealDelayMs}ms` } as CSSProperties}
      onClick={onPick}
    >
      <div className="relic-shrine-card-icon-badge">
        <RelicIcon relicId={relic.id} className="relic-card-icon" />
      </div>
      <div className="relic-shrine-card-body">
        <span className="relic-card-name">{relic.name}</span>
        <p className="relic-shrine-card-desc">{relic.description ?? 'No effect described.'}</p>
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
  const [claimed, setClaimed] = useState(false);

  /** The relic to show in the post-claim reveal moment below — pickedRelicId stays set through the claim, so this only needs to look it up once `claimed` flips true. */
  const claimedRelic = claimed && pickedRelicId ? relics[pickedRelicId] : null;

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

  /** True while the screen's one bottom button is still a Claim rather than a Continue — the two never render together. */
  const showClaimButton =
    nodeType === 'currencyReward' || nodeType === 'upgradeReward'
      ? !claimed
      : nodeType === 'relicReward'
        ? !claimed && relicChoices.length > 0
        : false;

  return (
    <div className="node-screen node-reward-screen" style={{ '--node-rgb': NODE_TINT[nodeType] } as CSSProperties}>
      <NodeSky />

      {/* One header per node type, on one stage. What was here: four
          bordered banners (`.equip-cache-banner` twice, `.relic-shrine-banner`,
          each inside a `.reward-panel`) introducing content that was itself in
          boxes — see docs/visual-language.md's ninth pass. The eyebrow/title/
          readout is the same object the level-up screen uses; only the hue and
          the words change. */}
      {nodeType === 'currencyReward' && (
        <NodeHeader
          eyebrow="Spoils"
          title="Gold Cache"
          glyph={<ResourceMark label="G" />}
          readoutLive={claimed}
          readout={claimed ? `${currencyAmount}g added to the purse.` : 'A pile of gold, left where it fell.'}
        />
      )}

      {nodeType === 'upgradeReward' && (
        <NodeHeader
          eyebrow="Spoils"
          title="XP Cache"
          glyph={<ResourceMark label="XP" tone="green" />}
          readoutLive={claimed}
          readout={claimed ? `${upgradeAmount} XP added to the pool.` : 'Hard-won experience, there for the taking.'}
        />
      )}

      {nodeType === 'equipmentReward' && chestPhase === 'revealed' && (
        <NodeHeader
          compact
          eyebrow="A Cache Opens"
          title="Equipment Cache"
          glyph={<RunGlyph kind="equipment" />}
          readout="Tap a piece of gear to select it, hold to read it in full."
        />
      )}

      {nodeType === 'relicReward' && !claimed && (
        <NodeHeader
          compact
          eyebrow="A Pact Awaits"
          title="Relic Shrine"
          glyph={<RunGlyph kind="relic" />}
          readout={relicChoices.length > 0 ? 'Tap a relic to select it, then claim it.' : 'Every relic here is already yours.'}
        />
      )}

      <div className="screen-scroll">
        {/* Gold and XP have nothing to choose between, so the amount itself is
            the screen: one numeral at display size, lit by the node's own hue.
            It was a line of hint text inside a bordered banner. */}
        {(nodeType === 'currencyReward' || nodeType === 'upgradeReward') && (
          <div className={`node-hoard${claimed ? ' is-claimed' : ''}`}>
            <span className="node-hoard-amount">
              {nodeType === 'currencyReward' ? currencyAmount : upgradeAmount}
              <span className="node-hoard-unit">{nodeType === 'currencyReward' ? 'g' : 'XP'}</span>
            </span>
          </div>
        )}

        {nodeType === 'equipmentReward' && chestPhase !== 'revealed' && (
          <div className="equip-cache-chest-screen">
            <div className="equip-cache-chest-reveal">
              <div className="equip-cache-chest-glow" aria-hidden="true" />
              <div className={`equip-cache-chest-icon${chestPhase === 'opening' ? ' opening' : ''}`}>
                <RunGlyph kind="equipment" />
              </div>
              <p className="hint">Opening the cache…</p>
            </div>
          </div>
        )}

        {nodeType === 'equipmentReward' && chestPhase === 'revealed' && (
          <div className="bottom-pinned">
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
          </div>
        )}

        {nodeType === 'relicReward' && !claimed && relicChoices.length > 0 && (
          <div className="bottom-pinned">
            <div className="relic-shrine-list">
              {relicChoices.map((relic, i) => (
                <RelicChoiceCard
                  key={relic.id}
                  relic={relic}
                  picked={pickedRelicId === relic.id}
                  onPick={() => setPickedRelicId(pickedRelicId === relic.id ? null : relic.id)}
                  revealDelayMs={80 + i * 90}
                />
              ))}
            </div>
          </div>
        )}

        {/* Deliberately its own top-level sibling rather than nested in the
            picker above (same reasoning as the Equipment Cache's chest-reveal
            split) — this replaces the pick-a-relic list entirely once a claim
            lands, so obtaining a relic reads as its own moment instead of a
            line of text where the picker used to be. */}
        {nodeType === 'relicReward' && claimedRelic && (
          <div className="relic-reveal">
            <div className="relic-reveal-flash" aria-hidden="true" />
            <div className="relic-reveal-icon-badge">
              <RelicIcon relicId={claimedRelic.id} className="relic-reveal-icon" />
            </div>
            <div className="relic-reveal-eyebrow">Relic Claimed</div>
            <h2 className="relic-reveal-name">{claimedRelic.name}</h2>
            {claimedRelic.description && <p className="relic-reveal-desc">{claimedRelic.description}</p>}
          </div>
        )}
      </div>

      {/* One CTA, not two. Claiming used to be a full-width gold button inside
          the panel with a second full-width gold button ("Continue") directly
          under it — two identical-looking primaries, one of which was inert.
          The bottom button is now whichever of the two the screen is actually
          waiting for. */}
      {(nodeType === 'currencyReward' || nodeType === 'upgradeReward') && !claimed && (
        <button
          className="resolve-button"
          onClick={() =>
            handleClaimInstant(
              nodeType === 'currencyReward' ? grantCurrencyReward(run, currencyAmount) : grantUpgradeReward(run, upgradeAmount)
            )
          }
        >
          {nodeType === 'currencyReward' ? `Claim ${currencyAmount}g` : `Claim ${upgradeAmount} XP`}
        </button>
      )}

      {nodeType === 'equipmentReward' && chestPhase === 'revealed' && (
        <button
          className="resolve-button equip-cache-reveal-in"
          style={{ animationDelay: `${120 + equipmentChoices.length * 90}ms` } as CSSProperties}
          disabled={!pickedItemId}
          onClick={() => pickedItemId && onClaimEquipment(pickedItemId)}
        >
          {pickedItemId ? `Claim ${equipmentChoices.find((i) => i.id === pickedItemId)?.name}` : 'Select a piece of gear'}
        </button>
      )}

      {nodeType === 'relicReward' && !claimed && relicChoices.length > 0 && (
        <button
          className="resolve-button relic-shrine-claim-button"
          disabled={!pickedRelicId}
          onClick={() => pickedRelicId && handleClaimRelic(pickedRelicId)}
        >
          {pickedRelicId ? `Claim ${relicChoices.find((r) => r.id === pickedRelicId)?.name}` : 'Select a relic'}
        </button>
      )}

      {nodeType !== 'equipmentReward' && !showClaimButton && (
        <button className="resolve-button" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
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
                          <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtGrant(amount)}
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
