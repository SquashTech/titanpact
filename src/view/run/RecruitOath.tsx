import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import type { MoveDefinition } from '../../engine/content';
import { levelOf } from '../../run/growth';
import { innatePassiveIdsFor } from '../../run/innate';
import { formIdFor, rosterEntryTypes } from '../../run/progression';
import type { RosterEntry, RunState } from '../../run/state';
import { MoveDetailOverlay } from '../combat/MoveDetailOverlay';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { healCasterForEntry } from '../shared/healCaster';
import { HeroPortrait } from '../shared/HeroPortrait';
import { MasteryPips } from '../shared/MasteryPips';
import { MoveButtonReplica } from '../shared/MoveTile';
import { passiveColor, PassiveGlyph } from '../shared/passiveIcons';
import { PassiveText } from '../shared/PassiveText';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { TypeBadge } from '../shared/TypeBadge';
import { RosterPeek } from './RosterPeek';
import './recruitNode.css';

/** When the reveal is done and Continue may be pressed (ms). */
const OATH_SETTLED_MS = 2600;

/**
 * A hero sworn to the pact (docs/guild-hall-overhaul.md §2): a sigil in its type's colour, a beam
 * from above, the hero resolving out of silhouette, its name, and then everything it fights with —
 * the kit as the fight's own move buttons, each a tap away from its full card.
 */
export function RecruitOath({ run, entry, onContinue }: { run: RunState; entry: RosterEntry; onContinue: () => void }) {
  const hero = rosterHeroes[entry.heroId];
  const types = rosterEntryTypes(hero, entry);
  const caster = healCasterForEntry(hero, entry, run.relics);
  const innate = (innatePassiveIdsFor(hero, entry) ?? []).map((id) => passives[id]).filter(Boolean);
  const [reading, setReading] = useState<MoveDefinition | null>(null);
  const [settled, setSettled] = useState(() => prefersReducedMotion());

  useEffect(() => {
    playSfx('pact.bind');
    if (settled) return;
    const timer = window.setTimeout(() => setSettled(true), OATH_SETTLED_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`node-screen recruit-oath${settled ? ' is-settled' : ''}`}
      style={{ '--oath-color': getTypeColor(types[0]), '--oath-rgb': getTypeColorRgb(types[0]) } as CSSProperties}
      onClick={() => setSettled(true)}
    >
      <span className="recruit-oath-sky" aria-hidden="true" />
      <RosterPeek run={run} />
      <div className="screen-scroll">
        <div className="recruit-oath-stage" aria-hidden="true">
          <span className="recruit-oath-sigil">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="recruit-oath-beam" />
          <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="recruit-oath-hero" />
        </div>
        <h2 className="recruit-oath-name">{hero.name}</h2>
        <span className="recruit-oath-kicker">Sworn to the Pact</span>
        <span className="recruit-oath-rule" aria-hidden="true" />

        <div className="recruit-oath-sheet">
          <div className="recruit-oath-meta">
            {types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
            <span className="recruit-oath-level">Lv {levelOf(entry)}</span>
            <MasteryPips mastery={entry.mastery} />
          </div>
          {innate.map((passive) => (
            <div key={passive.id} className="recruit-oath-innate" style={{ '--passive-color': passiveColor(passive.id) } as CSSProperties}>
              <span className="recruit-oath-innate-name">
                <PassiveGlyph passiveId={passive.id} />
                {passive.name}
              </span>
              <span className="recruit-oath-innate-desc">
                <PassiveText passive={passive} />
              </span>
            </div>
          ))}
          <div className="move-list recruit-oath-moves">
            {entry.unlockedMoveIds
              .map((id) => moves[id])
              .filter(Boolean)
              .map((move) => (
                <MoveButtonReplica key={move.id} move={move} caster={caster} onClick={() => setReading(move)} onLongPress={() => setReading(move)} />
              ))}
          </div>
        </div>
      </div>

      <button className="resolve-button recruit-oath-continue" disabled={!settled} onClick={onContinue}>
        Continue
      </button>

      {reading && <MoveDetailOverlay move={reading} caster={caster} onClose={() => setReading(null)} />}
    </div>
  );
}
