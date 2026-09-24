import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { EnchantmentId, EquipmentDefinition } from '../../run/equipment';
import { ENCHANTMENT_IDS, ENCHANTMENTS, enchantLabel, ENCHANT_FORCE_BY_RARITY, parseEquipmentId } from '../../run/equipment';
import { anvilQuote, forgeable, forgeItem, forgeTarget, RunProgressError, type ItemRef } from '../../run/runProgress';
import type { RunState } from '../../run/state';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { enchantTypeOf, ItemEffectChips, ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS } from '../shared/EquipmentBox';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';
import { NodeHeader, NodeSky, NODE_TINT_HEARTH } from '../shared/NodeStage';
import { overlayHost } from '../shared/overlayHost';
import { RosterPeek } from './RosterPeek';
import { SmithyBeat, type SmithyWork } from './SmithyBeat';
import { refKey, SmithyBenches } from './SmithyBenches';
import { AnvilFigure, ForgeSign } from './smithyArt';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** The element a piece starts on: its holder's own, which is where an enchant's Force pays. */
function defaultEnchant(run: RunState, ref: ItemRef, itemId: string): EnchantmentId | null {
  const entry = run.roster.find((r) => r.rosterId === ref.rosterId);
  const primary = entry ? rosterHeroes[entry.heroId]?.types[0] : undefined;
  const own = ENCHANTMENT_IDS.find((id) => ENCHANTMENTS[id] === primary);
  if (own && forgeTarget(run, itemId, own, equipment)) return own;
  return ENCHANTMENT_IDS.find((id) => forgeTarget(run, itemId, id, equipment)) ?? null;
}

/**
 * The Forge (docs/run-loop.md "The Forge and the Ley Line"; 2026-09-24, per user direction:
 * "Upgrade and Enchant an item"). The Smithy's two verbs, free, on one worn piece: tap it, pick an
 * element, and it comes off the anvil a tier up AND bound (`forgeItem`). The lift is the paid
 * Anvil's quote, so the act window still caps it; a piece the Anvil would refuse is still bound.
 * It was the lift alone, which read as the weakest seat on a reward row.
 */
export function ForgeNodeScreen({ run, onRunChange, onContinue }: Props) {
  /** The socket forged and what came out — the readout's subject once the beat has cleared. */
  const [forged, setForged] = useState<{ key: string; after: EquipmentDefinition } | null>(null);
  const [bench, setBench] = useState<{ ref: ItemRef; item: EquipmentDefinition } | null>(null);
  const [beat, setBeat] = useState<SmithyWork | null>(null);

  useEffect(() => {
    playSfx('anvil.ring', { pitch: 0.85, delay: 0.15 });
  }, []);

  const workable = run.roster.reduce((n, entry) => n + entry.equipment.filter((itemId) => forgeable(run, itemId, equipment)).length, 0);
  const done = forged !== null;

  function handleForge(ref: ItemRef, before: EquipmentDefinition, enchantId: EnchantmentId) {
    try {
      const quote = anvilQuote(run, before.id, equipment);
      const next = forgeItem(run, ref, enchantId, equipment);
      const after = equipment[next.roster.find((r) => r.rosterId === ref.rosterId)!.equipment[ref.index]!]!;
      const lifted = quote ? (equipment[quote.targetId] ?? null) : null;
      onRunChange(next);
      setBench(null);
      setForged({ key: refKey(ref), after });
      setBeat({ kind: 'forge', before, lifted, after });
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
      playSfx('ui.denied');
    }
  }

  const afterType = forged ? enchantTypeOf(forged.after) : null;
  const readout = forged
    ? `${forged.after.name}: ${RARITY_LABELS[forged.after.rarity]}${afterType ? `, ${afterType}-bound` : ''}.`
    : workable === 0
      ? 'Nothing the roster wears can be forged here. Walk on.'
      : 'Upgrade and Enchant an item.';

  return (
    <div className="node-screen forge-node-screen" style={{ '--node-rgb': NODE_TINT_HEARTH } as CSSProperties}>
      <NodeSky />

      <RosterPeek run={run} />

      <NodeHeader
        compact
        eyebrow="Iron and Ember"
        title="The Forge"
        glyph={<HubGlyph name="anvil" />}
        readoutKey={forged?.key ?? 'idle'}
        readoutLive={done}
        readout={readout}
      />

      <div className="screen-scroll">
        <ForgeSign />
        <SmithyBenches
          run={run}
          liftFor={(item) => {
            const quote = anvilQuote(run, item.id, equipment);
            return quote && !done ? { targetRarity: quote.targetRarity, label: `Forges to ${RARITY_LABELS[quote.targetRarity]}` } : null;
          }}
          pickable={(item) => !done && forgeable(run, item.id, equipment)}
          onPick={(ref, item) => {
            if (!done) setBench({ ref, item });
          }}
          fresh={beat ? null : (forged?.key ?? null)}
        />
      </div>

      <button className="resolve-button" disabled={!done && workable > 0} onClick={onContinue}>
        {workable === 0 && !done ? 'Walk on' : 'Continue'}
      </button>

      {bench && (
        <ForgeSheet
          run={run}
          itemRef={bench.ref}
          item={bench.item}
          onForge={(enchantId) => handleForge(bench.ref, bench.item, enchantId)}
          onClose={() => setBench(null)}
        />
      )}

      {beat && <SmithyBeat work={beat} onDone={() => setBeat(null)} />}
    </div>
  );
}

/**
 * One piece on the Forge's bench: what it is, what it becomes, and the element it binds. The
 * holder's own element is picked to start with — the one its Force pays on — so the common case is
 * one press, and every other element can still be read and chosen before anything lands.
 */
function ForgeSheet({
  run,
  itemRef,
  item,
  onForge,
  onClose,
}: {
  run: RunState;
  itemRef: ItemRef;
  item: EquipmentDefinition;
  onForge: (enchantId: EnchantmentId) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<EnchantmentId | null>(() => defaultEnchant(run, itemRef, item.id));
  const entry = run.roster.find((r) => r.rosterId === itemRef.rosterId);
  const hero = entry ? rosterHeroes[entry.heroId] : undefined;
  const quote = anvilQuote(run, item.id, equipment);
  const targetId = picked ? forgeTarget(run, item.id, picked, equipment) : null;
  const target = targetId ? (equipment[targetId] ?? null) : null;
  const heldEnchant = parseEquipmentId(item.id).enchantId ?? null;
  const toRarity = quote ? quote.targetRarity : item.rarity;
  const pickedType = picked ? ENCHANTMENTS[picked] : null;

  const style = {
    '--hero-color': hero ? getTypeColor(hero.types[0]) : undefined,
    '--pact-rgb': hero ? getTypeColorRgb(hero.types[0]) : undefined,
    '--rarity-color': RARITY_COLOR_VARS[item.rarity],
    '--rarity-rgb': RARITY_RGB_VARS[item.rarity],
  } as CSSProperties;

  return createPortal(
    <div className="detail-overlay is-sheet smithy-sheet" onClick={onClose}>
      <div className="detail-panel smithy-work forge-work" style={style} onClick={(e) => e.stopPropagation()}>
        <div className="smithy-work-head">
          {hero && entry && (
            <span className="smithy-work-holder">
              <span className="smithy-work-plate">
                <HeroPortrait heroId={hero.id} className="smithy-work-portrait" />
              </span>
              <span className="smithy-work-holder-text">
                <span className="smithy-work-holder-name">{hero.name}</span>
                <span className="smithy-work-holder-level">wears</span>
              </span>
            </span>
          )}
          <span className="smithy-work-piece">
            <ItemPiece item={item} />
          </span>
          <span className="smithy-work-title">
            <span className="smithy-work-name">{item.name}</span>
            <span className="smithy-work-rarity">
              {RARITY_LABELS[item.rarity]}
              {heldEnchant ? ` · ${ENCHANTMENTS[heldEnchant]}-bound` : ''}
            </span>
          </span>
        </div>

        <div className="smithy-work-body">
          <section className="smithy-service is-anvil">
            <header className="smithy-service-head">
              <AnvilFigure className="smithy-service-art" />
              <span className="smithy-service-title">Upgrade</span>
              <span className="smithy-service-sub">
                {quote ? 'A tier up. Same family.' : 'This piece cannot rise a tier here — the Forge binds it only.'}
              </span>
            </header>
            <div className="smithy-lift">
              <span className="smithy-tier-pill" style={{ '--pill-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
                {RARITY_LABELS[item.rarity]}
              </span>
              <span className="smithy-lift-arrow" aria-hidden="true">
                ➜
              </span>
              <span className="smithy-tier-pill is-target" style={{ '--pill-color': RARITY_COLOR_VARS[toRarity] } as CSSProperties}>
                {RARITY_LABELS[toRarity]}
              </span>
              {target && (
                <span className="smithy-lift-chips">
                  <ItemEffectChips item={target} labelled />
                </span>
              )}
            </div>
          </section>

          <section className="smithy-service is-enchant">
            <header className="smithy-service-head">
              <span className="smithy-service-art is-circle" aria-hidden="true" />
              <span className="smithy-service-title">Enchant</span>
              <span className="smithy-service-sub">
                Bind an element: Force +{ENCHANT_FORCE_BY_RARITY[toRarity]} to a hero of that type.
                {heldEnchant ? ' Rebinding overwrites.' : ''}
              </span>
            </header>
            <div className="smithy-elements">
              {ENCHANTMENT_IDS.map((enchantId) => {
                const type = ENCHANTMENTS[enchantId];
                const possible = forgeTarget(run, item.id, enchantId, equipment) !== null;
                const isPicked = picked === enchantId;
                const held = heldEnchant === enchantId;
                return (
                  <button
                    key={enchantId}
                    type="button"
                    className={`smithy-element${isPicked ? ' is-picked' : ''}${held ? ' is-held' : ''}`}
                    style={{ '--type-color': getTypeColor(type), '--type-rgb': getTypeColorRgb(type) } as CSSProperties}
                    disabled={!possible}
                    aria-pressed={isPicked}
                    data-sfx={isPicked ? 'none' : 'ui.select'}
                    onClick={() => setPicked(enchantId)}
                  >
                    <ElementGlyph type={type} className="smithy-element-glyph" />
                    <span className="smithy-element-name">{enchantLabel(enchantId)}</span>
                    {held && <span className="smithy-element-held">Bound</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <button
            className="smithy-commit is-strike forge-commit"
            data-sfx="none"
            disabled={!picked || !target}
            style={pickedType ? ({ '--commit-color': getTypeColor(pickedType) } as CSSProperties) : undefined}
            onClick={() => picked && target && onForge(picked)}
          >
            <HubGlyph name="anvil" className="smithy-commit-glyph" />
            <span className="smithy-commit-label">{picked ? `Forge ${enchantLabel(picked)}` : 'Pick an element'}</span>
            {pickedType && <ElementGlyph type={pickedType} className="smithy-commit-glyph" />}
          </button>
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
