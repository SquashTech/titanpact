import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { boonMoveCount, boonMoveType, pickBoonOffers } from '../../run/boons';
import { grantEventPassive } from '../../run/events';
import { entryPassiveCounts } from '../../run/entryStats';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_ARCANE } from '../shared/NodeStage';
import { PassiveGlyph, passiveColor, passiveKindLabel, passiveTint } from '../shared/passiveIcons';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

function BoonChoiceCard({ passiveId, picked, onPick }: { passiveId: string; picked: boolean; onPick: () => void }) {
  const passive = passives[passiveId];
  const color = passiveColor(passiveId);
  return (
    <button
      className={`relic-card relic-shrine-card boon-shrine-card${picked ? ' picked' : ''}`}
      style={{ '--boon-color': color } as CSSProperties}
      onClick={onPick}
    >
      <span className="relic-shrine-card-icon-badge boon-card-badge" style={{ color, background: passiveTint(passiveId, 0.18) }}>
        <PassiveGlyph passiveId={passiveId} className="boon-card-icon" />
      </span>
      <span className="boon-card-body">
        <span className="relic-card-name">{passive.name}</span>
        <span className="relic-card-desc">{passive.description}</span>
        <span className="boon-card-kind">{passiveKindLabel(passive)}</span>
      </span>
    </button>
  );
}

/**
 * `passiveReward` node: pick 1 of 3 Boons, then the hero it settles on. Same three-phase shape as
 * the Mentor (select-then-confirm, tap-to-assign, reveal) because it is the same decision — a
 * permanent, hero-specific grant that the player should not be able to mis-tap their way into.
 *
 * Unlike a Class, a Boon STACKS: `grantEventPassive` appends, so every hero is eligible however
 * many they already hold, and a card showing "×1 already" is an invitation rather than a block.
 */
export function BoonNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [boonChoices] = useState(() => pickBoonOffers(run.roster, heroes));
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const confirmed = confirmedId ? passives[confirmedId] : null;
  const assignedEntry = assignedTo ? run.roster.find((r) => r.rosterId === assignedTo) ?? null : null;
  const assignedHero = assignedEntry ? heroes[assignedEntry.heroId] : null;

  function handleAssign(rosterId: string) {
    if (!confirmedId) return;
    playSfx('class.learn');
    onRunChange(grantEventPassive(run, rosterId, confirmedId, passives));
    setAssignedTo(rosterId);
  }

  /** How many copies this hero already carries, from every source — the card's "already holds" line. */
  function heldCount(entry: RosterEntry): number {
    return confirmedId ? entryPassiveCounts(entry, equipment)[confirmedId] ?? 0 : 0;
  }

  /**
   * What a hero brings to a type-locked Boon: how many of its moves the bonus would fire on. The
   * pool filter guarantees somebody on the roster fields the type — this is what stops the player
   * putting the Iron Boon on the hero who has no Iron, which the filter alone cannot.
   */
  function boonDetail(entry: RosterEntry) {
    const held = heldCount(entry);
    const type = boonMoveType(confirmed ?? undefined);
    const count = boonMoveCount(confirmed ?? undefined, entry, moves);
    if (count === null) return held > 0 ? <span className="boon-held-note">already holds ×{held}</span> : undefined;
    return (
      <span className={`boon-fit-note${count === 0 ? ' is-dead' : ''}`}>
        {count === 0 ? `no ${type} moves` : `${count} ${type} move${count === 1 ? '' : 's'}`}
        {held > 0 ? ` · holds ×${held}` : ''}
      </span>
    );
  }

  return (
    <div className="node-screen boon-node-screen" style={{ '--node-rgb': NODE_TINT_ARCANE } as CSSProperties}>
      <NodeSky />

      <RosterPeek run={run} />

      {!assignedTo && (
        <NodeHeader
          compact
          eyebrow={confirmed ? 'Choose a Vessel' : 'A Power Stirs'}
          title={confirmed ? confirmed.name : 'The Shrine'}
          glyph={confirmed ? <PassiveGlyph passiveId={confirmed.id} /> : undefined}
          readout={
            confirmed
              ? `${confirmed.description} Hold a hero to review its sheet.`
              : 'Tap a boon to select it, then choose who it settles on. It stays with them for the rest of the run.'
          }
        />
      )}

      {/* Phase 2's grid is a direct child of the screen (not inside `.screen-scroll`) so its figures
          sit at the same height as on the Mentor and the stat shrines. */}
      {!confirmed ? (
        <div className="screen-scroll">
          <div className="stage-centered">
            <div className="relic-shrine-list">
              {boonChoices.map((id) => (
                <BoonChoiceCard key={id} passiveId={id} picked={pickedId === id} onPick={() => setPickedId(pickedId === id ? null : id)} />
              ))}
            </div>
          </div>
        </div>
      ) : !assignedTo ? (
        <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                onActivate={() => handleAssign(entry.rosterId)}
                onPreview={() => setPreviewEntry({ hero, entry })}
                ariaLabel={`${hero.name}, level ${entry.level} — grant this boon`}
                ctaClassName="is-accent"
                cta="Grant"
                detail={boonDetail(entry)}
              />
            );
          })}
        </HeroPickGrid>
      ) : (
        <div className="screen-scroll">
          {assignedHero && confirmed && (
            <div className="class-learn-reveal">
              <div className="class-learn-flash" aria-hidden="true" />
              <div className="class-learn-portraits">
                <span
                  className="boon-reveal-badge"
                  style={{ color: passiveColor(confirmed.id), background: passiveTint(confirmed.id, 0.18) }}
                >
                  <PassiveGlyph passiveId={confirmed.id} className="boon-reveal-icon" />
                </span>
                <span className="class-learn-arrow" aria-hidden="true">
                  →
                </span>
                <HeroPortrait heroId={assignedHero.id} className="class-learn-hero" />
              </div>
              <div className="class-learn-eyebrow">Boon Granted</div>
              <h2 className="class-learn-title">{assignedHero.name}</h2>
              <div className="class-learn-classname" style={{ color: passiveColor(confirmed.id) }}>
                {confirmed.name}
              </div>
              <p className="relic-reveal-desc">{confirmed.description}</p>
            </div>
          )}
        </div>
      )}

      {!confirmed ? (
        <button
          className="resolve-button relic-shrine-claim-button"
          disabled={!pickedId}
          onClick={() => pickedId && setConfirmedId(pickedId)}
        >
          {pickedId ? `Confirm ${passives[pickedId].name}` : 'Select a boon'}
        </button>
      ) : (
        <button className="resolve-button" disabled={!assignedTo} onClick={onContinue}>
          Continue
        </button>
      )}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
