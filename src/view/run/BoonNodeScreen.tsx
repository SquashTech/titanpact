import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { withSeededRandom } from '../shared/seededRandom';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import type { HeroDefinition, PassiveDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { boonMoveCount, boonMoveType, chargeBoonMoveCount, pickBoonOffers } from '../../run/boons';
import { grantEventPassive } from '../../run/events';
import { entryPassiveCounts } from '../../run/entryStats';
import { HeroPortrait } from '../shared/HeroPortrait';
import { currentEvolutionPathId } from '../../run/progression';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { useLongPress } from '../shared/MoveTile';
import { NodeMotes, NODE_TINT_ARCANE } from '../shared/NodeStage';
import { PassiveGlyph, PassiveReadout, passiveColor } from '../shared/passiveIcons';
import { PassiveDetailOverlay } from '../shared/PassiveDossier';
import shrineArt from '../../../art/map-nodes/icons/passiveReward.png';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';
import { PlateButton } from '../shared/PlateButton';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
  /** Fixes the screen's roll, so a resumed run is offered the same (docs/save-system.md D2). */
  seed: number;
}

/** One Boon as a verb card: its mark in a socket, its name and kind, the rule in a line. Tap picks; hold reads it whole. */
function BoonCard({
  passive,
  picked = false,
  dimmed = false,
  onPick,
  onRead,
}: {
  passive: PassiveDefinition;
  picked?: boolean;
  dimmed?: boolean;
  onPick?: () => void;
  onRead: () => void;
}) {
  const longPress = useLongPress(onRead, onPick);
  return (
    <div
      className={`verb-card${picked ? ' is-picked' : ''}${dimmed ? ' is-dimmed' : ''}`}
      style={{ '--rite-color': passiveColor(passive.id) } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-pressed={picked}
      aria-label={`${passive.name}: ${passive.description}`}
      data-sfx="none"
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onPick) {
          e.preventDefault();
          onPick();
        }
      }}
      {...longPress}
    >
      <span className="verb-card-socket" aria-hidden="true">
        <PassiveGlyph passiveId={passive.id} className="verb-card-glyph" />
      </span>
      <span className="verb-card-body">
        <span className="verb-card-head">
          <span className="verb-card-name">{passive.name}</span>
        </span>
        <span className="verb-card-desc is-full">{passive.description}</span>
      </span>
    </div>
  );
}

/**
 * `passiveReward` node: pick 1 of 3 Boons, then the hero it settles on, then the reveal — a
 * permanent, hero-specific grant the player should not be able to mis-tap their way into. It is
 * staged as a rite at the woken Shrine (the Academy's Class choice in violet): the Boons as verb cards,
 * the chosen one lit over the roster, and the hero it settles on standing in its light.
 *
 * Unlike a Class, a Boon STACKS: `grantEventPassive` appends, so every hero is eligible however
 * many they already hold, and a card showing "holds ×1" is an invitation rather than a block.
 */
export function BoonNodeScreen({ run, onRunChange, onContinue, seed }: Props) {
  const [boonChoices] = useState(() => withSeededRandom(seed, () => pickBoonOffers(run.roster, rosterHeroes)));
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [reading, setReading] = useState<PassiveDefinition | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const picked = pickedId ? passives[pickedId] : null;
  const confirmed = confirmedId ? passives[confirmedId] : null;
  const assignedEntry = assignedTo ? run.roster.find((r) => r.rosterId === assignedTo) ?? null : null;
  const assignedHero = assignedEntry ? rosterHeroes[assignedEntry.heroId] : null;
  const leaning = confirmed ?? picked;

  function handleAssign(rosterId: string) {
    if (!confirmedId) return;
    playSfx('class.learn');
    onRunChange(grantEventPassive(run, rosterId, confirmedId, passives));
    setAssignedTo(rosterId);
  }

  /** How many copies this hero already carries, from every source — the card's "holds" line. */
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
    const refills = chargeBoonMoveCount(confirmed ?? undefined, entry, moves);
    if (refills !== null) {
      return (
        <span className={`boon-fit-note${refills === 0 ? ' is-dead' : ''}`}>
          {refills === 0 ? 'nothing to refill' : `${refills} move${refills === 1 ? '' : 's'} with Charges`}
          {held > 0 ? ` · holds ×${held}` : ''}
        </span>
      );
    }
    if (count === null) return held > 0 ? <span className="boon-held-note">already holds ×{held}</span> : undefined;
    return (
      <span className={`boon-fit-note${count === 0 ? ' is-dead' : ''}`}>
        {count === 0 ? `no ${type} moves` : `${count} ${type} move${count === 1 ? '' : 's'}`}
        {held > 0 ? ` · holds ×${held}` : ''}
      </span>
    );
  }

  const style = {
    '--node-rgb': NODE_TINT_ARCANE,
    '--rite-color': leaning ? passiveColor(leaning.id) : '#9b6bff',
  } as CSSProperties;

  // The reveal: the hero at the shrine, the Boon's mark landing on it, the rule read whole below.
  if (assignedHero && confirmed) {
    return (
      <div className="node-screen rite-screen is-shrine boon-node-screen" style={style}>
        <span className="node-sky shrine-ground" aria-hidden="true" />
        <NodeMotes count={14} />
        <div className="screen-scroll">
          <div className="rite-reveal">
            <span className="rite-reveal-flash" aria-hidden="true" />
            <span className="rite-hero">
              <span className="rite-pool" aria-hidden="true" />
              <HeroPortrait heroId={assignedHero.id} pathId={assignedEntry && currentEvolutionPathId(assignedEntry)} className="rite-portrait" />
              <span className="rite-mark is-reveal" aria-hidden="true">
                <PassiveGlyph passiveId={confirmed.id} />
              </span>
            </span>
            <span className="rite-eyebrow">Boon Granted</span>
            <h2 className="rite-name">{assignedHero.name}</h2>
            <span className="rite-reveal-name">{confirmed.name}</span>
            <div className="rite-reveal-verb">
              <PassiveReadout passive={confirmed} source="Boon" />
            </div>
          </div>
        </div>
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className={`node-screen rite-screen is-shrine boon-node-screen${confirmed ? ' is-choosing-vessel' : ''}`} style={style}>
      <span className="node-sky shrine-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <RosterPeek run={run} />

      <header className="rite-head">
        <span className="rite-place">
          <span className="rite-pool" aria-hidden="true" />
          <img src={shrineArt} className="rite-place-art is-icon" alt="" draggable={false} />
        </span>
        <span className="rite-eyebrow">A Wayside Shrine</span>
        <h2 className="rite-name">{confirmed ? 'Who carries it?' : 'Choose a Boon'}</h2>
      </header>

      {!confirmed ? (
        <>
          <div className="verb-card-list">
            {boonChoices.map((id) => (
              <BoonCard
                key={id}
                passive={passives[id]}
                picked={pickedId === id}
                dimmed={!!pickedId && pickedId !== id}
                onPick={() => {
                  playSfx('ui.pick');
                  setPickedId(pickedId === id ? null : id);
                }}
                onRead={() => setReading(passives[id])}
              />
            ))}
          </div>
          <PlateButton disabled={!picked} onClick={() => pickedId && setConfirmedId(pickedId)}>
            {picked ? `Take — ${picked.name}` : 'Choose a Boon'}
          </PlateButton>
        </>
      ) : (
        <>
          <div className="boon-vessel-verb">
            <BoonCard passive={confirmed} picked onRead={() => setReading(confirmed)} />
          </div>
          <HeroPickGrid count={run.roster.length} fill columns={run.roster.length > 4 ? 3 : 2}>
            {run.roster.map((entry) => {
              const hero = rosterHeroes[entry.heroId];
              return (
                <HeroPickCard
                  key={entry.rosterId}
                  hero={hero}
                  entry={entry}
                  onActivate={() => handleAssign(entry.rosterId)}
                  onPreview={() => setPreviewEntry({ hero, entry })}
                  ariaLabel={`${hero.name}, level ${levelOf(entry)} — grant this boon`}
                  ctaClassName="is-accent"
                  cta="Grant"
                  detail={boonDetail(entry)}
                />
              );
            })}
          </HeroPickGrid>
        </>
      )}

      {reading && <PassiveDetailOverlay passive={reading} onClose={() => setReading(null)} />}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
