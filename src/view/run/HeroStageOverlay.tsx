import { useState, type CSSProperties, type ReactNode } from 'react';
import { classes } from '../../data/classes';
import { equipment } from '../../data/equipment';
import { passives } from '../../data/passives';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition, MoveDefinition, PassiveDefinition } from '../../engine/content';
import { chosenClass } from '../../run/classes';
import { entryPassiveCounts, entryStatModifiers } from '../../run/entryStats';
import { levelOf } from '../../run/growth';
import { chosenEvolutionPaths, rosterEntryTypes } from '../../run/progression';
import type { RosterEntry } from '../../run/state';
import type { StatScale } from '../../run/statScale';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { RARITY_COLOR_VARS } from '../shared/EquipmentBox';
import { healCasterForEntry } from '../shared/healCaster';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { StageDais, StageFigure, StageInnate, StageKit, StageSheet, StageTypes, heroHasBurden } from '../shared/HeroStage';
import { PassiveDetailCard } from '../shared/PassiveDossier';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

interface Props {
  hero: HeroDefinition;
  entry: RosterEntry;
  /** The team's relics, for the tabbed sheet the figure's info button opens. */
  relicIds?: readonly string[];
  scale?: StatScale;
  /** A hero not on the roster (a Guild hire): the tabbed sheet hides its Gear page. */
  unowned?: boolean;
  /** Rendered above the action — why it is inert, or what confirming will additionally cost. */
  note?: ReactNode;
  /** The footer's slab. Omit for a read-only look. */
  action?: { label: string; disabled?: boolean; onConfirm: () => void };
  onClose: () => void;
}

/**
 * A hero on the draft's stage (shared/HeroStage.tsx) as an overlay: the dais and the fight's move
 * console in the hero sheet's panel, the action and Close in the sheet footer. The Guild Hall opens
 * it off a hire card and the roster-replace gate off a held roster card. The figure's `i` opens the
 * tabbed sheet over it, read-only — the slab here is the one decision.
 */
export function HeroStageOverlay({ hero, entry, relicIds, scale, unowned = false, note, action, onClose }: Props) {
  const [inspecting, setInspecting] = useState(false);
  const [popupMove, setPopupMove] = useState<MoveDefinition | null>(null);
  const [popupPassive, setPopupPassive] = useState<PassiveDefinition | null>(null);

  const types = rosterEntryTypes(hero, entry);
  const grants = entryStatModifiers(entry, equipment, passives, entryPassiveCounts(entry, equipment));
  const caster = healCasterForEntry(hero, entry);
  const evolutions = chosenEvolutionPaths(progressionTable, entry);
  const heroClass = chosenClass(classes, entry);
  const worn = entry.equipment.map((id) => equipment[id]).filter((item) => item !== undefined);

  return (
    <div className="detail-overlay is-sheet" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div
        className="detail-panel is-hero-sheet stage-overlay-panel"
        style={{ '--hero-color': getTypeColor(hero.types[0]), '--pact-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <StageDais>
          <StageFigure heroId={hero.id} heroName={hero.name} onInspect={() => setInspecting(true)}>
            <span className="recruit-level" aria-label={`Level ${levelOf(entry)}`}>
              Lv {levelOf(entry)}
            </span>
          </StageFigure>
          <div className="draft-ident">
            <h3 className="draft-name">{hero.name}</h3>
            <StageTypes types={types} />
            {(evolutions.length > 0 || heroClass || worn.length > 0) && (
              <div className="recruit-veteran">
                {evolutions.map((path) => (
                  <span key={path.id} className="recruit-veteran-mark">
                    ✦ {path.name}
                  </span>
                ))}
                {heroClass && <span className="recruit-veteran-mark">◆ {heroClass.name}</span>}
                {worn.map((item) => (
                  <span key={item.id} className="recruit-veteran-mark" style={{ color: RARITY_COLOR_VARS[item.rarity] }}>
                    ▣ {item.name}
                  </span>
                ))}
              </div>
            )}
            <StageSheet baseStats={hero.baseStats} grants={grants} scale={scale} burden={heroHasBurden(hero)} />
          </div>
        </StageDais>
        <StageInnate hero={hero} onOpen={setPopupPassive} />
        <StageKit moveIds={entry.unlockedMoveIds} caster={caster} onPick={setPopupMove} />
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        {note && <div className="detail-action-note">{note}</div>}
        {action && (
          <button className="resolve-button sheet-close-button stage-overlay-action" disabled={action.disabled} onClick={action.onConfirm}>
            {action.label}
          </button>
        )}
        <button className={action ? 'secondary-button' : 'resolve-button sheet-close-button'} onClick={onClose}>
          Close
        </button>
      </div>

      {inspecting && (
        <HeroPreviewOverlay
          hero={hero}
          entry={entry}
          equipmentLookup={equipment}
          relicIds={relicIds}
          scale={scale}
          unowned={unowned}
          onClose={() => setInspecting(false)}
        />
      )}

      {/* Inline rather than the portalled StageMovePopup: this overlay can sit inside another
          (the roster-replace gate, z-index 30), and a dossier portalled to the shell at 25 would
          paint under it. Same markup the tabbed sheet uses for its own popup. */}
      {popupMove && (
        <div
          className="log-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setPopupMove(null);
          }}
        >
          <div className="log-panel move-popup-panel">
            <MoveDetailCard move={popupMove} caster={caster} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
      {popupPassive && (
        <div
          className="log-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setPopupPassive(null);
          }}
        >
          <div className="log-panel move-popup-panel">
            <PassiveDetailCard passive={popupPassive} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
