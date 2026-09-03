import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import { classes } from '../../data/classes';
import { chosenClass } from '../../run/classes';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import type { RelicDefinition } from '../../run/relics';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { RelicIcon } from '../shared/EquipmentBox';
import { stackedGrantSummary, stackedRelicName } from '../shared/relicStacks';
import { ResourceGlyph } from '../shared/RunGlyph';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterManagementScreen } from './RosterManagementScreen';

interface Props {
  run: RunState;
  /** Extra classes on the button — `corner-slot-2` steps it left beside a second corner glyph (SquadSelectScreen). */
  className?: string;
  /**
   * Opt in to the full Manage Roster screen behind the glyph (the Guild Hall). Omit inside a forced
   * allocation gate: a panel that can move gear mid-placement could change the thing being placed.
   */
  onRunChange?: (next: RunState) => void;
}

/** The corner roster glyph every pick-a-hero screen carries, and the read-only overlay it opens. */
export function RosterPeek({ run, className, onRunChange }: Props) {
  const [open, setOpen] = useState(false);
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  /** Folded by id: a stacked relic is one chip carrying its summed total. */
  const relicCounts = new Map<string, number>();
  for (const id of run.relics) relicCounts.set(id, (relicCounts.get(id) ?? 0) + 1);
  const ownedRelics = [...relicCounts]
    .map(([id, count]) => ({ relic: relics[id], count }))
    .filter((r): r is { relic: RelicDefinition; count: number } => !!r.relic);

  return (
    <>
      <button
        type="button"
        className={`corner-glyph-button roster-peek-button${className ? ` ${className}` : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Check your roster"
        title="Check your roster"
      >
        <span aria-hidden="true">👥</span>
      </button>

      {open && onRunChange && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setOpen(false)} />}

      {open && !onRunChange && (
        <div className="log-overlay roster-peek-overlay" onClick={() => setOpen(false)}>
          <div className="log-panel roster-peek-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Your Roster</span>
              <button className="log-close-button" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <div className="roster-peek-resources">
              <span className="roster-peek-resource" title="Gold">
                <ResourceGlyph kind="gold" /> {run.gold}
              </span>
              <span className="roster-peek-resource" title="Unspent XP">
                <ResourceGlyph kind="xp" /> {run.levelUpPool}
              </span>
              <span className="roster-peek-resource" title="Recruit Contracts">
                <ResourceGlyph kind="contract" /> {run.recruitContracts}
              </span>
            </div>

            {ownedRelics.length > 0 && (
              <div className="roster-peek-relics">
                {ownedRelics.map(({ relic, count }) => {
                  const summary = count > 1 ? stackedGrantSummary(relic, count) : '';
                  return (
                    <span
                      key={relic.id}
                      className="roster-peek-relic"
                      title={(summary && `Team-wide ${summary}.`) || relic.description || relic.name}
                    >
                      <RelicIcon relicId={relic.id} className="roster-peek-relic-icon" />
                      {stackedRelicName(relic, count)}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="screen-scroll">
              <HeroPickGrid count={run.roster.length}>
                {run.roster.map((entry) => {
                  const hero = heroes[entry.heroId];
                  const heroClass = chosenClass(classes, entry);
                  return (
                    <HeroPickCard
                      key={entry.rosterId}
                      hero={hero}
                      entry={entry}
                      onActivate={() => setInspecting({ hero, entry })}
                      onPreview={() => setInspecting({ hero, entry })}
                      ariaLabel={`${hero.name}, level ${entry.level} — view sheet`}
                      /* The Class if any; the card's own badge already shows the level. */
                      cta={heroClass ? heroClass.name.replace('Class - ', '') : 'Inspect'}
                    />
                  );
                })}
              </HeroPickGrid>
            </div>

            <div className="move-popup-hint">Tap a hero to read its full sheet</div>
          </div>
        </div>
      )}

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setInspecting(null)}
        />
      )}
    </>
  );
}
