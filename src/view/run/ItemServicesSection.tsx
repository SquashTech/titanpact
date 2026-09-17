import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { levelOf } from '../../run/growth';
import { itemSlotsFor, rosterEntryTypes } from '../../run/progression';
import { anvilQuote, type ItemRef } from '../../run/runProgress';
import type { RunState } from '../../run/state';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { enchantTypeOf, ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS, slotBoxes } from '../shared/EquipmentBox';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';
import { SmithyBeat, type SmithyWork } from './SmithyBeat';
import { SmithyWorkSheet } from './SmithyWorkSheet';
import { AnvilFigure } from './smithyArt';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
}

/** Which socket is on the bench, keyed the way the roster addresses it. */
function refKey(ref: ItemRef): string {
  return `${ref.rosterId}:${ref.index}`;
}

/** Embers off the forge, laid out once so the header does not re-scatter on every render. */
const EMBERS = Array.from({ length: 9 }, (_, i) => {
  const seed = i * 137.51;
  return { x: 18 + ((seed * 0.37) % 64), delay: (seed * 0.9) % 3200, dur: 2600 + ((seed * 0.5) % 1800), size: 2 + ((seed * 0.11) % 2) };
});

/**
 * The Guild Hall's smithy (docs/equipment.md §5; docs/gear-absorption.md §6), rebuilt as a room
 * rather than a list (2026-09-16, per user direction). Every piece the player owns is on a hero,
 * so the tab is the roster: each hero's bench, the hero on it, and its three sockets — the same
 * sockets the who-screen fills. A tap on a piece opens its work sheet (SmithyWorkSheet); the
 * Anvil and the Enchanter both happen there, and what they make is played out on the piece
 * (SmithyBeat) before the bench shows it. The list it replaces put eighteen identical rows under
 * two price buttons each, and read as an invoice.
 */
export function ItemServicesSection({ run, onRunChange }: Props) {
  const [working, setWorking] = useState<ItemRef | null>(null);
  /** The beat playing over the work just paid for, and the socket it lands in. */
  const [beat, setBeat] = useState<{ work: SmithyWork; key: string } | null>(null);
  /** The socket the last piece of work landed in, lit for a moment once the beat clears. */
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    if (!fresh) return;
    const timer = window.setTimeout(() => setFresh(null), 2400);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  const total = run.roster.reduce((n, entry) => n + entry.equipment.length, 0);
  /** A lift the purse covers right now. The badge and the tally read the same test (2026-09-17, per user direction — a badge on a lift the player cannot pay for is a badge on every piece by Act 3). */
  const affordableLift = (itemId: string) => {
    const quote = anvilQuote(run, itemId, equipment);
    return quote && run.gold >= quote.cost ? quote : null;
  };
  const liftable = run.roster.reduce((n, entry) => n + entry.equipment.filter((itemId) => affordableLift(itemId) !== null).length, 0);

  const workingEntry = working ? run.roster.find((r) => r.rosterId === working.rosterId) : null;
  const workingHero = workingEntry ? rosterHeroes[workingEntry.heroId] : null;
  const workingItem = working && workingEntry ? equipment[workingEntry.equipment[working.index] ?? ''] : null;

  return (
    <div className="smithy">
      {/* The forge itself, as the counter's sign: the anvil lit from below, embers rising off it.
          The tally under it is the whole of what the tab has to say before a bench is opened. */}
      <div className="smithy-forge" aria-hidden="true">
        <span className="smithy-forge-glow" />
        <span className="smithy-forge-embers">
          {EMBERS.map((e, i) => (
            <i
              key={i}
              style={
                {
                  left: `${e.x}%`,
                  width: `${e.size}px`,
                  height: `${e.size}px`,
                  animationDelay: `${e.delay}ms`,
                  animationDuration: `${e.dur}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>
        <AnvilFigure className="smithy-forge-anvil" />
      </div>
      <div className="guild-hall-section-head">
        <span className="guild-hall-section-title">
          <HubGlyph name="anvil" /> Anvil &amp; Enchanter
        </span>
        <span className="guild-hall-section-hint">
          {total === 0
            ? 'Nobody is wearing anything yet.'
            : `${total} ${total === 1 ? 'piece' : 'pieces'} on the roster · ${liftable} you can lift · tap one to work it`}
        </span>
      </div>

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
                  const quote = affordableLift(item.id);
                  const enchantType = enchantTypeOf(item);
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`smithy-socket${fresh === key ? ' is-fresh' : ''}`}
                      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
                      data-sfx="ui.select"
                      title={`${item.name} — ${RARITY_LABELS[item.rarity]}`}
                      onClick={() => setWorking(ref)}
                    >
                      <span className="smithy-socket-box">
                        <ItemPiece item={item} />
                        {quote && (
                          <span
                            className="smithy-socket-lift"
                            style={{ '--lift-color': RARITY_COLOR_VARS[quote.targetRarity] } as CSSProperties}
                            aria-label={`Can be lifted to ${RARITY_LABELS[quote.targetRarity]} for ${quote.cost} gold`}
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

      {working && workingEntry && workingHero && workingItem && (
        <SmithyWorkSheet
          run={run}
          hero={workingHero}
          entry={workingEntry}
          itemRef={working}
          item={workingItem}
          onCommit={(next, work) => {
            onRunChange(next);
            setWorking(null);
            setBeat({ work, key: refKey(working) });
          }}
          onClose={() => {
            playSfx('ui.back');
            setWorking(null);
          }}
        />
      )}

      {beat && (
        <SmithyBeat
          work={beat.work}
          onDone={() => {
            setFresh(beat.key);
            setBeat(null);
          }}
        />
      )}
    </div>
  );
}
