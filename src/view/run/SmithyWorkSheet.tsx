import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { EnchantmentId, EquipmentDefinition } from '../../run/equipment';
import {
  actAllowsRarity,
  ENCHANT_FORCE_BY_RARITY,
  ENCHANTMENT_IDS,
  ENCHANTMENTS,
  enchantLabel,
  equipmentIdFor,
  nextRarity,
  parseEquipmentId,
} from '../../run/equipment';
import { levelOf } from '../../run/growth';
import { anvilQuote, anvilUpgrade, enchantItem, RunProgressError, type ItemRef } from '../../run/runProgress';
import { ENCHANT_PRICE_BY_RARITY } from '../../run/shop';
import { TOTAL_ACTS, type RosterEntry, type RunState } from '../../run/state';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { enchantTypeOf, ItemEffectChips, ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS } from '../shared/EquipmentBox';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { formIdFor } from '../../run/progression';
import { HubGlyph } from '../shared/nodeIcons';
import { ResourceGlyph } from '../shared/RunGlyph';
import { overlayHost } from '../shared/overlayHost';
import { useArmedTap } from '../shared/useArmedTap';
import type { SmithyWork } from './SmithyBeat';
import { AnvilFigure } from './smithyArt';

interface Props {
  run: RunState;
  hero: HeroDefinition;
  entry: RosterEntry;
  itemRef: ItemRef;
  item: EquipmentDefinition;
  /** The run with the work paid for, and what to play over it. */
  onCommit: (next: RunState, work: SmithyWork) => void;
  onClose: () => void;
}

/** Why the Anvil will not take this piece today — the sheet says it rather than greying a button. */
function anvilRefusal(run: RunState, item: EquipmentDefinition): string {
  if (item.familyId === undefined) return 'A Unique has no ladder to climb.';
  const target = nextRarity(item.rarity);
  if (target === null) return 'Nothing stands above Mythic.';
  for (let act = run.actNumber + 1; act <= TOTAL_ACTS; act++) {
    if (actAllowsRarity(act, target)) return `${RARITY_LABELS[target]} is not forged until Act ${act}.`;
  }
  return `${RARITY_LABELS[target]} is not forged in this act.`;
}

/**
 * One piece on the bench (2026-09-16, per user direction). The Anvil and the Enchanter used to be
 * two price buttons at the end of a list row, so the run's dearest purchases were read off a
 * number with a glyph beside it. Here the piece is the subject: the hero wearing it, what it does
 * now, and the two things the smith can do to it — each on its own slab, each stating what it
 * would MAKE (the next tier's chips; the element's Force) before the button that pays for it.
 */
export function SmithyWorkSheet({ run, hero, entry, itemRef, item, onCommit, onClose }: Props) {
  const [pickedEnchant, setPickedEnchant] = useState<EnchantmentId | null>(null);

  const quote = anvilQuote(run, item.id, equipment);
  const lifted = quote ? equipment[quote.targetId] : null;
  const anvilAffordable = !!quote && run.gold >= quote.cost;

  const enchantCost = ENCHANT_PRICE_BY_RARITY[item.rarity];
  const heldEnchant = parseEquipmentId(item.id).enchantId ?? null;
  const parsed = parseEquipmentId(item.id);
  const boundTarget = pickedEnchant ? equipment[equipmentIdFor(parsed.base, parsed.rarity, pickedEnchant)] : null;
  const enchantAffordable = run.gold >= enchantCost;
  const heldType = enchantTypeOf(item);

  function commit(fn: () => RunState, work: SmithyWork) {
    try {
      onCommit(fn(), work);
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
      playSfx('ui.denied');
    }
  }

  const strike = useArmedTap(() => {
    if (!quote || !lifted) return;
    commit(() => anvilUpgrade(run, itemRef, equipment), { kind: 'anvil', before: item, after: lifted });
  }, anvilAffordable);
  const bind = useArmedTap(() => {
    if (!pickedEnchant || !boundTarget) return;
    commit(() => enchantItem(run, itemRef, pickedEnchant, equipment), { kind: 'enchant', before: item, after: boundTarget });
  }, !!pickedEnchant && !!boundTarget && enchantAffordable);

  const heroColor = getTypeColor(hero.types[0]);
  const style = {
    '--hero-color': heroColor,
    '--pact-rgb': getTypeColorRgb(hero.types[0]),
    '--rarity-color': RARITY_COLOR_VARS[item.rarity],
    '--rarity-rgb': RARITY_RGB_VARS[item.rarity],
  } as CSSProperties;

  return createPortal(
    <div className="detail-overlay is-sheet smithy-sheet" onClick={onClose}>
      <div className="detail-panel smithy-work" style={style} onClick={(e) => e.stopPropagation()}>
        {/* The piece, on its holder's bench: who wears it, and what it does now. */}
        <div className="smithy-work-head">
          <span className="smithy-work-piece">
            <ItemPiece item={item} />
          </span>
          <span className="smithy-work-title">
            <span className="smithy-work-name">{item.name}</span>
            <span className="smithy-work-rarity">
              {RARITY_LABELS[item.rarity]}
              {heldType ? ` · ${heldType}-bound` : ''}
            </span>
            <span className="smithy-work-holder">
              <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="smithy-work-portrait" />
              <span className="smithy-work-holder-name">{hero.name}</span>
              <span className="smithy-work-holder-level">Lv {levelOf(entry)} · wears</span>
            </span>
            <span className="smithy-work-chips">
              <ItemEffectChips item={item} labelled />
            </span>
          </span>
        </div>

        <div className="smithy-work-body">
          {/* The Anvil: this tier to the next. The next tier's chips are printed so the strike buys
              something the player has read, not a colour change. */}
          <section className={`smithy-service is-anvil${quote ? '' : ' is-closed'}`}>
            <header className="smithy-service-head">
              <AnvilFigure className="smithy-service-art" />
              <span className="smithy-service-title">The Anvil</span>
              <span className="smithy-service-sub">{quote ? 'Lift it a tier. Same family, same binding.' : anvilRefusal(run, item)}</span>
            </header>
            {quote && lifted && (
              <div className="smithy-lift">
                <span className="smithy-tier-pill" style={{ '--pill-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
                  {RARITY_LABELS[item.rarity]}
                </span>
                <span className="smithy-lift-arrow" aria-hidden="true">
                  ➜
                </span>
                <span className="smithy-tier-pill is-target" style={{ '--pill-color': RARITY_COLOR_VARS[quote.targetRarity] } as CSSProperties}>
                  {RARITY_LABELS[quote.targetRarity]}
                </span>
                <span className="smithy-lift-chips">
                  <ItemEffectChips item={lifted} labelled />
                </span>
              </div>
            )}
            <button
              ref={strike.ref}
              className={`smithy-commit is-strike${strike.armed ? ' is-armed' : ''}`}
              data-sfx="none"
              disabled={!anvilAffordable}
              style={quote ? ({ '--commit-color': RARITY_COLOR_VARS[quote.targetRarity] } as CSSProperties) : undefined}
              onClick={strike.onClick}
            >
              <HubGlyph name="anvil" className="smithy-commit-glyph" />
              <span className="smithy-commit-label">{!quote ? 'Cannot lift' : strike.armed ? 'Tap again' : 'Strike'}</span>
              {quote && (
                <span className={`smithy-commit-price${anvilAffordable ? '' : ' is-short'}`}>
                  <ResourceGlyph kind="gold" /> {quote.cost}
                </span>
              )}
            </button>
          </section>

          {/* The Enchanter: fourteen elements, one bound at a time. The pick is a selection and the
              button is the spend, so the whole grid can be read before anything is paid. */}
          <section className="smithy-service is-enchant">
            <header className="smithy-service-head">
              <span className="smithy-service-art is-circle" aria-hidden="true" />
              <span className="smithy-service-title">The Enchanter</span>
              <span className="smithy-service-sub">
                Bind an element: Force +{ENCHANT_FORCE_BY_RARITY[item.rarity]} to moves of that element.
                {heldEnchant ? ' Rebinding overwrites.' : ''}
              </span>
            </header>
            <div className="smithy-elements">
              {ENCHANTMENT_IDS.map((enchantId) => {
                const type = ENCHANTMENTS[enchantId];
                const held = heldEnchant === enchantId;
                const exists = !!equipment[equipmentIdFor(parsed.base, parsed.rarity, enchantId)];
                const picked = pickedEnchant === enchantId;
                return (
                  <button
                    key={enchantId}
                    type="button"
                    className={`smithy-element${picked ? ' is-picked' : ''}${held ? ' is-held' : ''}`}
                    style={{ '--type-color': getTypeColor(type), '--type-rgb': getTypeColorRgb(type) } as CSSProperties}
                    disabled={held || !exists}
                    aria-pressed={picked}
                    aria-label={held ? `${enchantLabel(enchantId)} (bound)` : enchantLabel(enchantId)}
                    title={enchantLabel(enchantId)}
                    data-sfx={picked ? 'none' : 'ui.select'}
                    onClick={() => setPickedEnchant(picked ? null : enchantId)}
                  >
                    {/* Glyph only, seven across: the picked element is named on the Bind button. */}
                    <ElementGlyph type={type} className="smithy-element-glyph" />
                    {held && <span className="smithy-element-held" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            <button
              ref={bind.ref}
              className={`smithy-commit is-bind${bind.armed ? ' is-armed' : ''}`}
              data-sfx="none"
              disabled={!pickedEnchant || !boundTarget || !enchantAffordable}
              style={pickedEnchant ? ({ '--commit-color': getTypeColor(ENCHANTMENTS[pickedEnchant]) } as CSSProperties) : undefined}
              onClick={bind.onClick}
            >
              {pickedEnchant ? <ElementGlyph type={ENCHANTMENTS[pickedEnchant]} className="smithy-commit-glyph" /> : null}
              <span className="smithy-commit-label">
                {!pickedEnchant ? 'Pick an element' : bind.armed ? 'Tap again' : `Bind ${enchantLabel(pickedEnchant)}`}
              </span>
              <span className={`smithy-commit-price${enchantAffordable ? '' : ' is-short'}`}>
                <ResourceGlyph kind="gold" /> {enchantCost}
              </span>
            </button>
          </section>
        </div>
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="secondary-button sheet-close-button smithy-close" data-sfx="none" onClick={onClose}>
          Leave the bench
        </button>
      </div>
    </div>,
    overlayHost()
  );
}
