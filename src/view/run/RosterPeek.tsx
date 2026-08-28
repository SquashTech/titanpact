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
import { ResourceMark } from '../shared/RunGlyph';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

interface Props {
  run: RunState;
  /**
   * Extra classes on the button itself — screens that show a second corner
   * glyph beside this one use `corner-slot-2` to step it left (see
   * SquadSelectScreen).
   */
  className?: string;
}

/**
 * The roster button every pick-a-hero screen carries, and the read-only
 * overlay it opens.
 *
 * Added 2026-08-28 per user direction: every screen that asks the player to
 * commit something to a hero — a Training Point, a piece of gear, a Class, a
 * permanent stat grant, a relic the whole team will carry — needs an answer
 * to "wait, what have I actually got?" without leaving the decision. A glyph
 * in the top corner, no words: the same discoverable-icon language the map
 * footer and the fight screen's log toggle already use.
 *
 * Deliberately read-only. Equipment is *moved* on the Manage Roster screen
 * (RosterManagementScreen, reachable from the map and before a fight); this
 * is inspection only, so opening it from inside a forced allocation gate
 * can't quietly change the thing being allocated.
 *
 * The grid is the shared HeroPickCard — the same figures the screen behind it
 * is already showing — so the overlay reads as the roster the player is
 * choosing from, not as a different list about it. Each card's CTA is what
 * that hero is currently specialised into (its Class, or its level when it
 * has none), and tapping one opens the full HeroPreviewOverlay sheet.
 */
export function RosterPeek({ run, className }: Props) {
  const [open, setOpen] = useState(false);
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const ownedRelics = run.relics.map((id) => relics[id]).filter((r): r is RelicDefinition => !!r);

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

      {open && (
        <div className="log-overlay roster-peek-overlay" onClick={() => setOpen(false)}>
          <div className="log-panel roster-peek-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Your Roster</span>
              <button className="log-close-button" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            {/* What the run is holding, in the same chip idiom the map header
                uses for the same three numbers — so the overlay answers "can I
                afford the other thing" as well as "who do I have". */}
            <div className="roster-peek-resources">
              <span className="roster-peek-resource" title="Gold">
                <ResourceMark label="G" /> {run.gold}
              </span>
              <span className="roster-peek-resource" title="Unspent XP">
                <ResourceMark label="XP" tone="green" /> {run.levelUpPool}
              </span>
              <span className="roster-peek-resource" title="Recruit Contracts">
                <ResourceMark label="C" tone="blue" /> {run.recruitContracts}
              </span>
            </div>

            {ownedRelics.length > 0 && (
              <div className="roster-peek-relics">
                {ownedRelics.map((relic, i) => (
                  <span key={`${relic.id}:${i}`} className="roster-peek-relic" title={relic.description ?? relic.name}>
                    <RelicIcon relicId={relic.id} className="roster-peek-relic-icon" />
                    {relic.name}
                  </span>
                ))}
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
                      /* The Class if there is one — the card already carries
                         the level in its own badge, so repeating it here would
                         spend the one free line on a fact stated 20px above. */
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
