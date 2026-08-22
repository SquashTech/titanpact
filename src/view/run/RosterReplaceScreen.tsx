import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { createEmptyLoadout } from '../../run/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import { createRosterEntry, ROSTER_CAP } from '../../run/state';
import type { RosterReplaceCandidate } from '../../run/recruitment';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useLongPress } from '../shared/MoveTile';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

export type { RosterReplaceCandidate };

interface Props {
  roster: RosterEntry[];
  candidate: RosterReplaceCandidate;
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
 */
function ReplaceHeroCard({ hero, entry, selected, onSelect, onPreview }: ReplaceHeroCardProps) {
  const longPress = useLongPress(onPreview, onSelect);
  return (
    <button type="button" className={`hero-grid-card${selected ? ' selected' : ''}`} style={{ borderLeftColor: getTypeColor(hero.types[0]) }} {...longPress}>
      <HeroPortrait heroId={hero.id} className="hero-grid-portrait" />
      <div className="hero-grid-name-row">
        <span className="hero-grid-name">{hero.name}</span>
        <span className="training-hero-level">Lv {entry.level}</span>
      </div>
      <div className="hero-grid-types">
        {rosterEntryTypes(hero, entry).map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      <span className="hero-grid-cta">{selected ? '✓ Selected' : 'Tap to select'}</span>
    </button>
  );
}

/**
 * Roster-full replacement gate (CLAUDE.md "Gaining a hero requires
 * terminating an existing one" once at ROSTER_CAP): the incoming hero (top
 * spotlight) needs a slot, so the player picks one of the 6 current heroes
 * (bottom grid, same 3x2 .hero-grid layout as LevelUpScreen/ForceEquipScreen)
 * to terminate in their place. Select-then-confirm (mirrors FightScreen's
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
export function RosterReplaceScreen({ roster, candidate, onConfirm, onCancel }: Props) {
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
      <div className="node-screen roster-replace-screen" onClick={(e) => e.stopPropagation()}>
        <div className="screen-scroll">
          <div className="bottom-pinned">
            <div className="equip-spotlight roster-replace-spotlight">
              <div className="equip-spotlight-glow" aria-hidden="true" />
              <div className="equip-spotlight-eyebrow">Roster Full — New Hero</div>
              <HeroPortrait heroId={hero.id} className="roster-replace-portrait" />
              <div className="equip-spotlight-name">{hero.name}</div>
              <div className="hero-grid-types roster-replace-types">
                {rosterEntryTypes(hero, previewNewEntry).map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
              <p className="hint">
                Your roster is full ({ROSTER_CAP}/{ROSTER_CAP}). Select a hero below to terminate — {hero.name} will take their
                slot and instantly inherit their equipped gear. {hero.name} will <strong>not</strong> gain the terminated hero's
                level, Evolution choices, or Class. This cannot be undone.
              </p>
            </div>

            <div className="hero-grid">
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
            </div>
          </div>
        </div>

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
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
