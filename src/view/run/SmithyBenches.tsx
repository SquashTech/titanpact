import type { CSSProperties } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { EquipmentDefinition, EquipmentRarity } from '../../run/equipment';
import { levelOf } from '../../run/growth';
import { itemSlotsFor, rosterEntryTypes } from '../../run/progression';
import type { ItemRef } from '../../run/runProgress';
import type { RunState } from '../../run/state';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { enchantTypeOf, ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS, slotBoxes } from '../shared/EquipmentBox';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';

/** Which socket is on the bench, keyed the way the roster addresses it. */
export function refKey(ref: ItemRef): string {
  return `${ref.rosterId}:${ref.index}`;
}

interface Props {
  run: RunState;
  /** The lift this piece could take — the badge on its socket — or null for none; `label` is the badge's aria text. */
  liftFor: (item: EquipmentDefinition) => { targetRarity: EquipmentRarity; label: string } | null;
  /** A socket that will not answer a tap: false locks it. Default every worn piece answers. */
  pickable?: (item: EquipmentDefinition) => boolean;
  onPick: (ref: ItemRef, item: EquipmentDefinition) => void;
  /** The socket the last piece of work landed in, lit for a moment. */
  fresh?: string | null;
}

/**
 * The roster as benches (2026-09-16, per user direction): each hero, the hero on it, and its
 * three sockets — the same sockets the who-screen fills. The Guild Hall's Smithy tab
 * (ItemServicesSection) and the Forge node (ForgeNodeScreen) are the same room with one
 * difference in what a tap does, so the room is drawn once.
 */
export function SmithyBenches({ run, liftFor, pickable, onPick, fresh }: Props) {
  return (
    <div className="smithy-benches">
      {run.roster.map((entry) => {
        const hero = rosterHeroes[entry.heroId];
        if (!hero) return null;
        const capacity = itemSlotsFor(hero, entry);
        const boxes = slotBoxes(entry.equipment, capacity);
        const bare = entry.equipment.length === 0;
        return (
          <section
            key={entry.rosterId}
            className={`smithy-bench${bare ? ' is-bare' : ''}`}
            style={{ '--hero-color': getTypeColor(hero.types[0]), '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
          >
            <div className="smithy-bench-hero">
              <span className="smithy-bench-figure">
                <span className="smithy-bench-ground" aria-hidden="true" />
                <HeroPortrait heroId={hero.id} className="smithy-bench-portrait" />
              </span>
              <span className="smithy-bench-ident">
                <span className="smithy-bench-name">{hero.name}</span>
                <span className="smithy-bench-meta">
                  <span className="smithy-bench-level">Lv {levelOf(entry)}</span>
                  {rosterEntryTypes(hero, entry).map((t) => (
                    <span key={t} className="smithy-bench-type" style={{ color: getTypeColor(t) }} title={t}>
                      <ElementGlyph type={t} />
                      {getTypeAbbr(t)}
                    </span>
                  ))}
                </span>
              </span>
            </div>

            <div className="smithy-sockets">
              {boxes.map((itemId, index) => {
                const item = itemId ? (equipment[itemId] ?? null) : null;
                const ref: ItemRef = { rosterId: entry.rosterId, index };
                const key = refKey(ref);
                if (!item) {
                  return (
                    <span key={index} className="smithy-socket is-empty" aria-label="Empty socket">
                      <span className="smithy-socket-box">
                        <ItemPiece item={null} />
                      </span>
                      <span className="smithy-socket-name">Open</span>
                    </span>
                  );
                }
                const lift = liftFor(item);
                const enchantType = enchantTypeOf(item);
                const locked = pickable ? !pickable(item) : false;
                return (
                  <button
                    key={index}
                    type="button"
                    className={`smithy-socket${fresh === key ? ' is-fresh' : ''}${locked ? ' is-locked' : ''}`}
                    style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
                    data-sfx="ui.select"
                    title={`${item.name} — ${RARITY_LABELS[item.rarity]}`}
                    disabled={locked}
                    onClick={() => onPick(ref, item)}
                  >
                    <span className="smithy-socket-box">
                      <ItemPiece item={item} />
                      {lift && (
                        <span
                          className="smithy-socket-lift"
                          style={{ '--lift-color': RARITY_COLOR_VARS[lift.targetRarity] } as CSSProperties}
                          aria-label={lift.label}
                        >
                          <HubGlyph name="anvil" />
                        </span>
                      )}
                    </span>
                    <span className="smithy-socket-name">{item.name}</span>
                    <span className="smithy-socket-tier">
                      {RARITY_LABELS[item.rarity]}
                      {enchantType && <ElementGlyph type={enchantType} className="smithy-socket-bound" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
