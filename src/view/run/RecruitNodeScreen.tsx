import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, TypeId } from '../../engine/content';
import { joinEventRecruit } from '../../run/events';
import { levelOf } from '../../run/growth';
import { ROSTER_CAP, type RosterEntry, type RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NodeMotes } from '../shared/NodeStage';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { mapNodeIcon } from './mapNodeArt';
import { EvolutionScreen } from './EvolutionScreen';
import { useMasteryFlow } from './masteryFlow';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';
import './recruitNode.css';

/** A type on offer and the heroes a pick of it could roll. */
export interface RecruitOffer {
  type: TypeId;
  heroIds: readonly string[];
}

interface Props {
  run: RunState;
  offers: readonly RecruitOffer[];
  /** Who answers a pick of `type`. Pure, so a reload meets the same hero. */
  entryFor: (type: TypeId) => RosterEntry | null;
  /** Held on the screen, so a reload cannot pick again. */
  pickedType: TypeId | null;
  onPick: (type: TypeId) => void;
  onRunChange: (next: RunState) => void;
  onRecruited?: (heroId: string) => void;
  /** A dismissed hero's gear, handed on through the item gate. Advances the node itself. */
  onGrantEquipment: (itemIds: string[]) => void;
  onContinue: () => void;
  /** A lesson: only this type can be picked, and the node cannot be left unanswered. */
  onlyType?: TypeId;
}

/** The Recruit tile's own colour (mapNodes NODE_COLORS). */
const RECRUIT_RGB = '155, 201, 255';

/**
 * The Recruit node (docs/guild-hall-overhaul.md §2): three types, each showing who could answer it,
 * dimmed. A tap sends word; one of them joins at the player's par, and at a full roster someone
 * leaves first.
 */
export function RecruitNodeScreen({ run, offers, entryFor, pickedType, onPick, onRunChange, onRecruited, onGrantEquipment, onContinue, onlyType }: Props) {
  // Read once: after the join, the roster it was rolled against has changed.
  const [arriving, setArriving] = useState<RosterEntry | null>(() => (pickedType ? entryFor(pickedType) : null));
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [handOn, setHandOn] = useState<string[]>([]);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('discovery', { pitch: 0.9 });
  }, []);

  const joined = arriving ? run.roster.some((r) => r.rosterId === arriving.rosterId && r.heroId === arriving.heroId) : false;

  // A recruit that arrives with the pips for its Evolution chooses its path here, as it joins.
  const flow = useMasteryFlow(run, onRunChange);

  function join(entry: RosterEntry, terminatedRosterId?: string) {
    setHandOn([...(run.roster.find((r) => r.rosterId === terminatedRosterId)?.equipment ?? [])]);
    const landed = joinEventRecruit(run, entry, terminatedRosterId);
    onRunChange(landed);
    setLeavingId(null);
    onRecruited?.(entry.heroId);
    flow.raise(entry.rosterId, landed);
  }

  const evolvingEntry = flow.evolving ? (run.roster.find((r) => r.rosterId === flow.evolving!.rosterId) ?? null) : null;
  if (flow.evolving && evolvingEntry) {
    return <EvolutionScreen hero={rosterHeroes[evolvingEntry.heroId]} entry={evolvingEntry} node={flow.evolving.node} run={run} onChoose={flow.chooseEvolution} />;
  }
  const overflowEntry = flow.overflow ? (run.roster.find((r) => r.rosterId === flow.overflow!.rosterId) ?? null) : null;

  function pick(type: TypeId) {
    const entry = entryFor(type);
    if (!entry) return;
    setArriving(entry);
    onPick(type);
    if (run.roster.length < ROSTER_CAP) join(entry);
  }

  const head = (
    <header className="rite-head">
      <span className="rite-place">
        <span className="rite-pool" aria-hidden="true" />
        <img src={mapNodeIcon('recruitReward')} className="rite-place-art is-icon" alt="" draggable={false} />
      </span>
      <span className="rite-eyebrow">{joined ? 'Joined the Pact' : arriving ? 'The roster is full' : 'Word Goes Out'}</span>
      <h2 className="rite-name">{arriving ? rosterHeroes[arriving.heroId].name : 'Recruit'}</h2>
    </header>
  );

  return (
    <div className="node-screen rite-screen recruit-node-screen" style={{ '--rite-color': `rgb(${RECRUIT_RGB})` } as CSSProperties}>
      <span className="node-sky" aria-hidden="true" />
      <NodeMotes count={10} />
      <RosterPeek run={run} />
      {head}

      {!arriving && (
        <div className="recruit-types">
          {offers.map(({ type, heroIds }) => {
            const open = !onlyType || onlyType === type;
            return (
              <button
                key={type}
                type="button"
                className="recruit-type"
                style={{ '--type-color': getTypeColor(type), '--type-rgb': getTypeColorRgb(type) } as CSSProperties}
                disabled={!open}
                aria-label={`${type}: ${heroIds.map((id) => rosterHeroes[id]?.name).join(', ')}`}
                onClick={() => pick(type)}
              >
                <ElementGlyph type={type} className="recruit-type-glyph" />
                <span className="recruit-type-name">{type}</span>
                <span className="recruit-type-faces" aria-hidden="true">
                  {heroIds.map((id) => (
                    <HeroPortrait key={id} heroId={id} className="recruit-type-face" />
                  ))}
                </span>
              </button>
            );
          })}
          {!onlyType && (
            <button className="moveoffer-button moveoffer-decline event-option" onClick={onContinue}>
              <span className="moveoffer-label">Leave</span>
            </button>
          )}
        </div>
      )}

      {arriving && (joined || run.roster.length < ROSTER_CAP) && (
        <div className="pick-grid pick-cols-2 recruit-arrival">
          <HeroPickCard
            hero={rosterHeroes[arriving.heroId]}
            entry={run.roster.find((r) => r.rosterId === arriving.rosterId) ?? arriving}
            onPreview={() => setPreviewEntry({ hero: rosterHeroes[arriving.heroId], entry: arriving })}
            ctaClassName="is-done"
            cta="Joined"
          />
        </div>
      )}

      {arriving && !joined && run.roster.length >= ROSTER_CAP && (
        <HeroPickGrid count={run.roster.length} fill columns={3} className="is-waking">
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                selected={leavingId === entry.rosterId}
                onActivate={() => setLeavingId(entry.rosterId)}
                onPreview={() => setPreviewEntry({ hero, entry })}
                ariaLabel={`${hero.name}, level ${levelOf(entry)} — leaves the pact`}
                ctaClassName={leavingId === entry.rosterId ? 'is-danger' : undefined}
                cta={leavingId === entry.rosterId ? 'Leaves' : 'Dismiss'}
              />
            );
          })}
        </HeroPickGrid>
      )}

      {arriving && !joined && run.roster.length >= ROSTER_CAP ? (
        <div className="reward-panel-actions moveoffer-actions event-leave-actions">
          <button className="moveoffer-button moveoffer-decline" onClick={onContinue}>
            <span className="moveoffer-label">Send away</span>
            <span className="moveoffer-sub">Nobody leaves</span>
          </button>
          <button className="moveoffer-button moveoffer-confirm" disabled={!leavingId} onClick={() => leavingId && join(arriving, leavingId)}>
            <span className="moveoffer-label">Confirm</span>
            <span className="moveoffer-sub">
              {leavingId ? `${rosterHeroes[run.roster.find((r) => r.rosterId === leavingId)!.heroId].name} leaves` : 'Choose who leaves'}
            </span>
          </button>
        </div>
      ) : (
        joined &&
        !flow.busy && (
          <button className="resolve-button" onClick={handOn.length > 0 ? () => onGrantEquipment(handOn) : onContinue}>
            Continue
          </button>
        )
      )}

      {flow.overflow && overflowEntry && (
        <MoveOfferOverlay
          run={run}
          entry={overflowEntry}
          moveId={flow.overflow.queue[0]}
          eyebrow={flow.overflow.eyebrow ?? 'The Evolution grants a move, and the kit is full'}
          onResolve={flow.resolveOverflow}
        />
      )}

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
