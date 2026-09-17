import { useState } from 'react';
import { rosterHeroes } from '../../data/content';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import { createRosterEntry } from '../../run/state';
import type { RosterReplaceCandidate } from '../../run/recruitment';
import { rosterEntryTypes } from '../../run/progression';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { HeroStageOverlay } from './HeroStageOverlay';
import { swallowGhostClick } from '../shared/MoveTile';
import { levelOf } from '../../run/growth';
import type { StatScale } from '../../run/statScale';

export type { RosterReplaceCandidate };

interface Props {
  roster: RosterEntry[];
  candidate: RosterReplaceCandidate;
  /** The entry a `guildHall` candidate would join as (run/guildRecruit.ts) — a hire arrives raised. */
  incomingEntry?: RosterEntry;
  /** The team's relics (RunState.relics), passed through to the hero sheets opened from here. */
  relicIds?: readonly string[];
  /** The run's stat reference (run/statScale.ts), passed through with them. */
  scale?: StatScale;
  /** Attempts the swap; false only if the offer was invalidated while this screen was open. */
  onConfirm: (terminatedRosterId: string) => boolean;
  onCancel: () => void;
}

interface ReplaceHeroCardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}

/** Tap selects rather than acts — termination is permanent; the confirm button commits. The detail row shows the gear that goes with them. */
function ReplaceHeroCard({ hero, entry, selected, onSelect, onPreview }: ReplaceHeroCardProps) {
  const equippedCount = entry.equipment.length;
  return (
    <HeroPickCard
      hero={hero}
      entry={entry}
      selected={selected}
      onActivate={onSelect}
      onPreview={onPreview}
      ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${selected ? 'selected for termination' : 'select to terminate'}`}
      detail={
        <span className="pick-slot empty">
          <span className="pick-slot-item">
            {equippedCount > 0 ? `${equippedCount} item${equippedCount > 1 ? 's' : ''} equipped` : 'No gear'}
          </span>
        </span>
      }
      ctaClassName={selected ? 'is-accent' : undefined}
      cta={selected ? '✓ Selected' : 'Terminate'}
    />
  );
}

/**
 * Roster-full replacement gate: pick one of the current rosterHeroes to terminate for the incoming one.
 * Rendered as an App Screen from the Guild Hall but as an in-place modal from RecruitScreen (a
 * remount there would lose which offers were already signed); this component doesn't care which.
 */
export function RosterReplaceScreen({ roster, candidate, incomingEntry, relicIds = [], scale, onConfirm, onCancel }: Props) {
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const heroId = candidate.offer.heroId;
  const hero = rosterHeroes[heroId];
  const previewNewEntry: RosterEntry =
    candidate.source === 'guildHall'
      ? (incomingEntry ?? createRosterEntry('preview', heroId, candidate.offer.startingMoveIds))
      : { ...candidate.offer, rosterId: 'preview' };

  const selectedEntry = selectedRosterId ? (roster.find((r) => r.rosterId === selectedRosterId) ?? null) : null;

  function handleConfirm() {
    if (!selectedRosterId) return;
    onConfirm(selectedRosterId);
  }

  return (
    <div className="detail-overlay roster-replace-overlay" onClick={onCancel}>
      <div className="node-screen roster-replace-screen" onClick={(e) => e.stopPropagation()}>
        <NodeSky motes={8} />

        <NodeHeader
          compact
          art={<HeroPortrait heroId={hero.id} className="roster-replace-portrait" />}
          eyebrow="Roster Full — New Hero"
          title={hero.name}
          readout={
            <>
              <span className="roster-replace-types">
                {rosterEntryTypes(hero, previewNewEntry).map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </span>
              <span className="roster-replace-note">
                Pick who {hero.name} replaces — hold one to look them over. Whatever that hero wears goes with them.
                Permanent.
              </span>
            </>
          }
        />

        {/* Three columns, not the two a six-hero `fill` grid picks: this screen's header (portrait,
            title, types, a two-line note) and its two stacked buttons leave ~410px, and three rows
            of 96px cards collapsed to their floor there with the names clipped. Two rows of 48px
            cards fit outright — and the roster is always full here, so it is always six. */}
        <HeroPickGrid count={roster.length} fill columns={3}>
          {roster.map((entry) => {
            const rosterHero = rosterHeroes[entry.heroId];
            return (
              <ReplaceHeroCard
                key={entry.rosterId}
                hero={rosterHero}
                entry={entry}
                selected={selectedRosterId === entry.rosterId}
                onSelect={() => setSelectedRosterId((prev) => (prev === entry.rosterId ? null : entry.rosterId))}
                // swallowGhostClick: the hold's release lands on the overlay that just opened, and
                // the synthesized click would reach this screen's backdrop and read as Cancel.
                onPreview={() => {
                  swallowGhostClick();
                  setPreviewEntry({ hero: rosterHero, entry });
                }}
              />
            );
          })}
        </HeroPickGrid>

        <div className="reward-panel-actions roster-replace-actions">
          <button className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="resolve-button" disabled={!selectedEntry} onClick={handleConfirm}>
            {selectedEntry ? `Terminate ${rosterHeroes[selectedEntry.heroId].name} & Add ${hero.name}` : 'Select a Hero to Terminate'}
          </button>
        </div>
      </div>

      {/* The held hero on the stage (HeroStageOverlay), its slab the same mark the card's CTA
          makes — select, never terminate, so the two-button row below stays the one commit. */}
      {previewEntry &&
        (() => {
          const marked = selectedRosterId === previewEntry.entry.rosterId;
          const { hero: heldHero, entry } = previewEntry;
          return (
            <HeroStageOverlay
              hero={heldHero}
              entry={entry}
              relicIds={relicIds}
              scale={scale}
              note={marked ? `${heldHero.name} is marked — ${hero.name} takes this seat.` : undefined}
              action={{
                label: marked ? `Spare ${heldHero.name}` : `Terminate ${heldHero.name}`,
                onConfirm: () => {
                  setSelectedRosterId(marked ? null : entry.rosterId);
                  setPreviewEntry(null);
                },
              }}
              onClose={() => setPreviewEntry(null)}
            />
          );
        })()}
    </div>
  );
}
