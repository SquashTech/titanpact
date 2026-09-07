import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { passives } from '../../data/passives';
import { statuses } from '../../data/statuses';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { compareEquipment, type EquipChange } from '../../run/equipCompare';
import { itemSlotsFor } from '../../run/progression';
import type { RosterEntry } from '../../run/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import { overlayHost } from '../shared/overlayHost';
import { ChangeChips, spokenChanges } from '../shared/EquipChangeChips';
import { PassiveGlyph } from '../shared/passiveIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EquipmentIcon, fmtGrant, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS } from '../shared/EquipmentBox';

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  /** Everything the hero holds, in slot order. */
  held: readonly EquipmentDefinition[];
  offered: EquipmentDefinition;
  /** Slot index to replace. */
  onReplace: (index: number) => void;
  onCancel: () => void;
}

/** One effect a player can tap to read: a granted passive, or an Elemental Force. */
type Effect = { key: string; name: string; description: string; glyph: React.ReactNode };

function effectsOf(item: EquipmentDefinition): Effect[] {
  const fromPassives = (item.grantsPassiveIds ?? []).flatMap((id) => {
    const def = passives[id];
    return def
      ? [{ key: `p:${id}`, name: def.name, description: def.description, glyph: <PassiveGlyph passiveId={id} /> }]
      : [];
  });
  const fromForces = (item.grantsStatusIds ?? []).flatMap(({ statusId, magnitude }) => {
    const def = statuses[statusId];
    if (!def) return [];
    return [
      {
        key: `s:${statusId}`,
        name: `${def.name} +${magnitude}`,
        description: def.description ?? '',
        glyph: def.forceType ? <ElementGlyph type={def.forceType} /> : null,
      },
    ];
  });
  return [...fromPassives, ...fromForces];
}

/** Stat grants as chips. The absolute reading of an item; the pros/cons below are the relative one. */
function GrantChips({ item }: { item: EquipmentDefinition }) {
  const grants = (Object.entries(item.statGrants) as [StatKey, number][]).filter(([, amount]) => amount);
  if (grants.length === 0) return null;
  return (
    <div className="detail-modifier-list">
      {grants.map(([stat, amount]) => (
        <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
          <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtGrant(amount)}
        </span>
      ))}
    </div>
  );
}

/** An item's effects as buttons — a tap prints the whole rule, so the sheet stays scannable. */
function EffectButtons({ item, onRead }: { item: EquipmentDefinition; onRead: (effect: Effect) => void }) {
  const effects = effectsOf(item);
  if (effects.length === 0) return null;
  return (
    <div className="swap-effect-row">
      {effects.map((effect) => (
        <button
          key={effect.key}
          type="button"
          className="swap-effect-button"
          onClick={(e) => {
            e.stopPropagation();
            onRead(effect);
          }}
        >
          {effect.glyph}
          <span className="swap-effect-name">{effect.name}</span>
          <span className="swap-effect-more" aria-hidden="true">
            ?
          </span>
        </button>
      ))}
    </div>
  );
}

/** The diff, split into what taking the offer buys and what it costs. */
function ProsAndCons({ changes }: { changes: readonly EquipChange[] }) {
  const pros = changes.filter((c) => c.delta > 0);
  const cons = changes.filter((c) => c.delta < 0);
  if (pros.length === 0 && cons.length === 0) return <div className="swap-ledger-empty">Nothing changes — the two are equivalent.</div>;
  return (
    <div className="swap-ledger">
      <div className="swap-ledger-side is-gain">
        <span className="swap-ledger-label">You gain</span>
        <div className="swap-ledger-chips">{pros.length > 0 ? <ChangeChips changes={pros} /> : <span className="equip-chip is-neutral">Nothing</span>}</div>
      </div>
      <div className="swap-ledger-side is-loss">
        <span className="swap-ledger-label">You lose</span>
        <div className="swap-ledger-chips">{cons.length > 0 ? <ChangeChips changes={cons} /> : <span className="equip-chip is-neutral">Nothing</span>}</div>
      </div>
    </div>
  );
}

/**
 * What a full hero opens (2026-09-07, per user direction): the incoming item read out in full,
 * then every item already on the hero read out beside what swapping it would cost. A full hero
 * used to answer a tap with an inline list of names, which asked the player to give something up
 * on the strength of a silhouette — this is the whole screen, so both sides can actually be read.
 *
 * Nothing here is a recommendation: the ledger is `compareEquipment`'s diff arranged as gains and
 * losses, and which side matters is the player's call (src/run/equipCompare.ts).
 */
export function EquipSwapScreen({ hero, entry, held, offered, onReplace, onCancel }: Props) {
  const [reading, setReading] = useState<Effect | null>(null);
  const capacity = itemSlotsFor(hero, entry);

  return createPortal(
    <div
      className="log-overlay equip-swap-overlay"
      style={{ '--rarity-color': RARITY_COLOR_VARS[offered.rarity], '--node-rgb': RARITY_RGB_VARS[offered.rarity] } as CSSProperties}
      onClick={onCancel}
    >
      <div className="log-panel equip-swap-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>
            <HeroPortrait heroId={hero.id} className="swap-head-portrait" /> {hero.name} — {capacity}/{capacity} slots full
          </span>
          <button className="log-close-button" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="screen-scroll">
          {/* The offer, once, at the top: every card below is read against it. */}
          <section className="swap-offer">
            <div className="swap-offer-head">
              <span className="swap-offer-badge">
                <EquipmentIcon item={offered} className="swap-offer-icon" />
              </span>
              <span className="swap-offer-ident">
                <span className="swap-offer-eyebrow">Incoming</span>
                <span className="swap-offer-name">{offered.name}</span>
                <span className="swap-offer-rarity">{RARITY_LABELS[offered.rarity]}</span>
              </span>
            </div>
            <GrantChips item={offered} />
            <EffectButtons item={offered} onRead={setReading} />
          </section>

          <div className="swap-prompt">Tap what it replaces.</div>

          {held.map((current, index) => {
            const changes = compareEquipment(current, offered);
            return (
              <button
                key={`${current.id}-${index}`}
                type="button"
                className="swap-option"
                style={{ '--held-rarity': RARITY_COLOR_VARS[current.rarity] } as CSSProperties}
                aria-label={`Replace ${current.name}. ${spokenChanges(changes) || 'No change'}`}
                onClick={() => onReplace(index)}
              >
                <div className="swap-option-head">
                  <span className="swap-option-badge">
                    <EquipmentIcon item={current} className="swap-option-icon" />
                  </span>
                  <span className="swap-option-ident">
                    <span className="swap-option-name">{current.name}</span>
                    <span className="swap-option-rarity">{RARITY_LABELS[current.rarity]}</span>
                  </span>
                  <span className="swap-option-cta">Replace</span>
                </div>
                <GrantChips item={current} />
                <EffectButtons item={current} onRead={setReading} />
                <ProsAndCons changes={changes} />
              </button>
            );
          })}
        </div>

        <button className="secondary-button swap-cancel" onClick={onCancel}>
          Keep {hero.name}'s kit as it is
        </button>
      </div>

      {reading && (
        <div className="log-overlay" onClick={(e) => (e.stopPropagation(), setReading(null))}>
          <div className="log-panel move-popup-panel">
            <div className="move-info-panel">
              <div className="move-info-head">
                <span className="move-info-name">
                  {reading.glyph} {reading.name}
                </span>
              </div>
              <div className="move-info-desc">{reading.description}</div>
            </div>
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>,
    overlayHost()
  );
}
