import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { createEmptyLoadout } from '../../run/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import { createRosterEntry } from '../../run/state';
import type { RosterReplaceCandidate } from '../../run/recruitment';
import { rosterEntryTypes } from '../../run/progression';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { EQUIP_SLOT_ORDER } from '../shared/EquipmentBox';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

export type { RosterReplaceCandidate };

interface Props {
  roster: RosterEntry[];
  candidate: RosterReplaceCandidate;
  /** The team's owned relics (RunState.relics) — passed straight through to the hero sheets opened from here so their stats include team-wide relic grants, same as everywhere else the player inspects their own heroes. */
  relicIds?: readonly string[];
  /** Attempts the swap; returns whether it succeeded. Only expected to fail if the offer was invalidated between this screen opening and confirming (e.g. gold/contracts spent elsewhere in a way the caller's own guards didn't already rule out) — rare enough not to need bespoke failure UI here. */
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

/**
 * One roster-grid card — tap SELECTS rather than acting immediately (unlike
 * LevelUpScreen's/ForceEquipScreen's grids), since termination is
 * destructive and permanent; the confirm button below the grid is what
 * actually commits. A hold still opens the full HeroPreviewOverlay sheet, so
 * the player can check exactly what they'd be giving up before picking them.
 *
 * The shared HeroPickCard as of 2026-08-28: this was the last pick-a-hero
 * grid in the run loop still on the legacy `.hero-grid-card`, whose 30px
 * portrait is the fractional-downscale defect docs/visual-language.md opens
 * with. Its detail row carries what the termination actually costs — the
 * gear that strips off (CLAUDE.md "Equipment strips on termination") — since
 * that is the part of the price the grid used to leave unsaid.
 */
function ReplaceHeroCard({ hero, entry, selected, onSelect, onPreview }: ReplaceHeroCardProps) {
  const equippedCount = EQUIP_SLOT_ORDER.filter((slot) => entry.equipment[slot]).length;
  return (
    <HeroPickCard
      hero={hero}
      entry={entry}
      selected={selected}
      onActivate={onSelect}
      onPreview={onPreview}
      ariaLabel={`${hero.name}, level ${entry.level} — ${selected ? 'selected for termination' : 'select to terminate'}`}
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
 * Roster-full replacement gate (CLAUDE.md "Gaining a hero requires
 * terminating an existing one" once at the roster cap): the incoming hero is
 * the header's art, and the player picks one of the 6 current heroes (the
 * shared HeroPickGrid, same as LevelUpScreen/ForceEquipScreen) to terminate
 * in their place. Select-then-confirm (mirrors FightScreen's
 * RecruitClaimCard), not tap-to-act like the other two grids — termination
 * is permanent and shouldn't be one accidental tap away.
 *
 * Rendered two different ways depending on which acquisition path triggered
 * it: Guild Hall recruiting at cap goes through App.tsx as a genuine
 * top-level Screen (`{ kind: 'rosterReplace' }`) since ShopNodeScreen has no
 * irreplaceable state to lose on a remount. A Recruit Contract claim at cap
 * (FightScreen's victory overlay) instead renders this as an in-place modal
 * over the fight screen — FightScreen's `combat` state is seeded from a
 * fresh random roll on mount (buildInitialState), so navigating away and
 * back via App.tsx's Screen state would silently replay the just-finished
 * fight from scratch. Either way this component only needs the current
 * roster + the incoming candidate; it doesn't know or care which context
 * it's in.
 */
export function RosterReplaceScreen({ roster, candidate, relicIds = [], onConfirm, onCancel }: Props) {
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const heroId = candidate.offer.heroId;
  const hero = heroes[heroId];
  const previewNewEntry: RosterEntry =
    candidate.source === 'guildHall'
      ? createRosterEntry('preview', heroId, candidate.offer.startingMoveIds)
      : { ...candidate.offer, rosterId: 'preview', equipment: createEmptyLoadout() };

  const selectedEntry = selectedRosterId ? (roster.find((r) => r.rosterId === selectedRosterId) ?? null) : null;

  function handleConfirm() {
    if (!selectedRosterId) return;
    onConfirm(selectedRosterId);
  }

  return (
    <div className="detail-overlay roster-replace-overlay" onClick={onCancel}>
      {/* Stands on the same node stage as the rest of the run loop's
          pick-a-hero screens (2026-08-28 pass): sky, unboxed header, filling
          grid, chunky CTA. The incoming hero used to be introduced by an
          `.equip-spotlight` — a bordered, glowing card around the one thing
          on this screen you cannot act on — sitting on top of a `.hero-grid`
          of 30px portraits. */}
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
                Pick who {hero.name} replaces — they inherit that hero's gear, not their level, Evolutions or Class. Permanent.
              </span>
            </>
          }
        />

        <HeroPickGrid count={roster.length} fill>
          {roster.map((entry) => {
            const rosterHero = heroes[entry.heroId];
            return (
              <ReplaceHeroCard
                key={entry.rosterId}
                hero={rosterHero}
                entry={entry}
                selected={selectedRosterId === entry.rosterId}
                onSelect={() => setSelectedRosterId((prev) => (prev === entry.rosterId ? null : entry.rosterId))}
                onPreview={() => setPreviewEntry({ hero: rosterHero, entry })}
              />
            );
          })}
        </HeroPickGrid>

        <div className="reward-panel-actions roster-replace-actions">
          <button className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="resolve-button" disabled={!selectedEntry} onClick={handleConfirm}>
            {selectedEntry ? `Terminate ${heroes[selectedEntry.heroId].name} & Add ${hero.name}` : 'Select a Hero to Terminate'}
          </button>
        </div>
      </div>

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={relicIds}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
