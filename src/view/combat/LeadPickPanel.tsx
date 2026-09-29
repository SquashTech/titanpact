// The lead pick (2026-09-28, per user direction): a run fight opens with the enemy's leads on the
// field and the player's two slots empty, and this panel sits in the console until the player has
// chosen who answers them. It replaced a screen before the fight that scouted the whole enemy party
// and asked for the leads blind to which two would open. The whole roster is here, HP as the fight
// has it and an arrow against each enemy lead, and the downed wear the Revive while one is held.
// Take the Field is the console's bottom row, where Back sits while a target is chosen.

import type { CSSProperties, ReactNode } from 'react';
import type { Combatant } from '../../engine/state';
import { effectiveTypes } from '../../engine/state';
import type { HeroDefinition, TypeId } from '../../engine/content';
import { getTypeColor } from './typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { BlessingMark } from '../shared/BlessingMark';
import { MatchupRow } from '../shared/MatchupArrows';
import { ResourceGlyph } from '../shared/RunGlyph';
import { WoundBar } from '../shared/WoundBar';
import { useLongPress } from '../shared/MoveTile';

export interface LeadPickHero {
  combatantId: string;
  hero: HeroDefinition;
  combatant: Combatant;
  level: number;
  maxHp: number;
}

interface Props {
  /** Standing heroes, in roster order. */
  candidates: readonly LeadPickHero[];
  /** Heroes the act left down, in roster order. */
  fallen: readonly LeadPickHero[];
  /** The enemy leads' typings in slot order — one arrow each on every cell. */
  enemyTypes: readonly (readonly TypeId[])[];
  picks: readonly string[];
  onToggle: (combatantId: string) => void;
  onInspect: (combatantId: string) => void;
  /** Present while a Revive is held. */
  onRevive?: (combatantId: string) => void;
}

export const LEAD_COUNT = 2;

function LeadCell({
  entry,
  picked,
  down,
  onActivate,
  onInspect,
  onRevive,
  children,
}: {
  entry: LeadPickHero;
  picked: boolean;
  down: boolean;
  onActivate: () => void;
  onInspect: () => void;
  onRevive?: () => void;
  children: ReactNode;
}) {
  const press = useLongPress(onInspect, onActivate);
  const { hero, level } = entry;
  return (
    <div
      className={`squad-slot filled${picked ? ' is-picked' : ''}${down ? ' is-down' : ''}`}
      style={{ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-pressed={down ? undefined : picked}
      aria-label={`${hero.name}, level ${level} — ${down ? 'down, hold to review' : `${picked ? 'leading, tap to un-pick' : 'tap to lead'}, hold to review`}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      {...press}
    >
      {children}
      {picked && (
        <span className="squad-slot-pick" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" focusable="false">
            <path d="M9.4 16.6 4.8 12l-1.9 1.9 6.5 6.5L21.1 8.7l-1.9-1.9Z" />
          </svg>
        </span>
      )}
      {onRevive && (
        <button
          type="button"
          className="squad-slot-swap squad-slot-revive"
          aria-label={`Revive ${hero.name}`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRevive();
          }}
        >
          <ResourceGlyph kind="revive" tone="inherit" />
        </button>
      )}
    </div>
  );
}

export function LeadPickPanel({ candidates, fallen, enemyTypes, picks, onToggle, onInspect, onRevive }: Props) {
  const required = Math.min(LEAD_COUNT, candidates.length);

  function cell(entry: LeadPickHero, down: boolean) {
    const { combatantId, hero, combatant, level, maxHp } = entry;
    const types = effectiveTypes(hero, combatant);
    return (
      <LeadCell
        key={combatantId}
        entry={entry}
        picked={picks.includes(combatantId)}
        down={down}
        onActivate={() => !down && onToggle(combatantId)}
        onInspect={() => onInspect(combatantId)}
        onRevive={down && onRevive ? () => onRevive(combatantId) : undefined}
      >
        <HeroPortrait heroId={hero.id} className="roster-card-portrait" />
        <span className="pick-level squad-slot-level" aria-hidden="true">
          {level}
        </span>
        {combatant.blessed && <BlessingMark className="squad-slot-blessing" />}
        <div className="roster-card-name">{hero.name}</div>
        <div className="roster-card-types">
          {types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
        {down ? <div className="squad-slot-down-label">Down</div> : <MatchupRow heroTypes={types} enemyTypes={enemyTypes} />}
        <WoundBar hp={combatant.currentHp} maxHp={maxHp} figure />
      </LeadCell>
    );
  }

  return (
    <div className="action-panel target-panel lead-pick-panel">
      <div className="target-panel-header">
        <span className="target-panel-title">
          {required > 1 ? 'Choose your leads' : 'Choose your lead'} · {picks.length}/{required}
        </span>
      </div>
      <div className="squad-grid lead-pick-grid">
        {candidates.map((entry) => cell(entry, false))}
        {fallen.map((entry) => cell(entry, true))}
      </div>
    </div>
  );
}
