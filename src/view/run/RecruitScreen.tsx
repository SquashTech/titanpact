import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { passives } from '../../data/passives';
import { classes } from '../../data/classes';
import { progressionTable } from '../../data/progression';
import type { MoveDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { ROSTER_CAP } from '../../run/state';
import { createEmptyLoadout } from '../../run/equipment';
import { entryPassiveCounts, entryStatModifiers } from '../../run/entryStats';
import { chosenEvolutionPaths, rosterEntryTypes } from '../../run/progression';
import { chosenClass } from '../../run/classes';
import { deriveContractOffer } from '../../run/recruitment';
import { getTypeColorRgb } from '../combat/typeColors';
import { healCasterForEntry } from '../shared/healCaster';
import {
  StageCandidate,
  StageFigure,
  StageKit,
  StageMovePopup,
  StageRail,
  StageSilhouette,
  StageSky,
  StageTypes,
} from '../shared/HeroStage';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';
import { RosterReplaceScreen } from './RosterReplaceScreen';

/** Past this many, the contract track collapses to a single seal and a count. */
const MAX_CONTRACT_PIPS = 6;

interface Props {
  run: RunState;
  /** Sampled once by the caller (App.tsx, via pickContractOffers) so re-renders can't reshuffle the offer. */
  offers: readonly RosterEntry[];
  /** Spends one contract and adds the hero; false only if contracts ran out between render and tap. */
  onClaim: (defeated: RosterEntry) => boolean;
  /** Roster-full variant, wired to the in-place RosterReplaceScreen below. */
  onClaimReplace: (defeated: RosterEntry, terminatedRosterId: string) => boolean;
  onDone: () => void;
  /**
   * The scripted first run (docs/tutorial.md): the offer cannot be walked past. The leave button
   * is withheld until something is signed — a lesson the player can decline is one some players
   * never see, and this one is the physical/magical split.
   */
  required?: boolean;
}

/**
 * The Recruit Contract claim, on the draft's stage (shared/HeroStage.tsx). App.tsx skips it when the
 * player holds no contracts. A veteran arrives with Evolutions and moves intact but gear stripped
 * (deriveContractOffer), so everything drawn here reads off an ungeared copy of the entry.
 */
export function RecruitScreen({ run, offers, onClaim, onClaimReplace, onDone, required = false }: Props) {
  const [featuredRosterId, setFeaturedRosterId] = useState<string>(offers[0].rosterId);
  const [claimedRosterIds, setClaimedRosterIds] = useState<string[]>([]);
  const [popupMove, setPopupMove] = useState<MoveDefinition | null>(null);
  const [inspecting, setInspecting] = useState(false);
  /** Opens RosterReplaceScreen over this screen rather than as an App Screen, so leaving and returning can't lose which offers are signed. */
  const [rosterReplaceEntry, setRosterReplaceEntry] = useState<RosterEntry | null>(null);
  /** The last hero signed, for the header's live readout. */
  const [signed, setSigned] = useState<string | null>(null);
  /** React key for the seal stamp: a rising counter, so remounting replays the mount-once animation. */
  const [stampTick, setStampTick] = useState(0);

  const featured = offers.find((entry) => entry.rosterId === featuredRosterId) ?? offers[0];
  const arriving: RosterEntry = { ...featured, equipment: createEmptyLoadout() };
  const hero = heroes[featured.heroId];
  const featuredClaimed = claimedRosterIds.includes(featured.rosterId);
  const contracts = run.recruitContracts;
  const rosterFull = run.roster.length >= ROSTER_CAP;
  const allClaimed = claimedRosterIds.length >= offers.length;
  const canSign = contracts > 0 && !featuredClaimed;
  const nothingLeftToSign = allClaimed || contracts <= 0;

  const passiveCounts = entryPassiveCounts(arriving, {});
  const grants = entryStatModifiers(arriving, {}, passives, passiveCounts);
  const evolutions = chosenEvolutionPaths(progressionTable, featured);
  const heroClass = chosenClass(classes, featured);

  function handleSign() {
    if (!canSign) return;
    if (rosterFull) {
      setRosterReplaceEntry(featured);
      return;
    }
    if (onClaim(featured)) markSigned(featured);
  }

  // The stamp lands here, not in handleSign: the roster-full path detours through
  // RosterReplaceScreen first, and both paths reach here only once the hero is on the roster.
  function markSigned(entry: RosterEntry) {
    playSfx('contract.sign');
    setStampTick((n) => n + 1);
    const nextClaimed = [...claimedRosterIds, entry.rosterId];
    setClaimedRosterIds(nextClaimed);
    setSigned(heroes[entry.heroId].name);
    const remaining = offers.find((o) => !nextClaimed.includes(o.rosterId));
    if (remaining) setFeaturedRosterId(remaining.rosterId);
  }

  return (
    <div className="draft-screen recruit-screen" style={{ '--pact-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}>
      <StageSky motes={12} />

      <RosterPeek run={run} />

      <header className="draft-header">
        <div className="draft-eyebrow">Spoils of Victory</div>
        <h2 className="draft-title">
          <span className="draft-title-glow" aria-hidden="true">
            Recruit Contract
          </span>
          Recruit Contract
        </h2>

        {/* Contracts owned as seal pips; the leftmost dims while a signable hero is on stage. */}
        <div
          className={`recruit-contracts${canSign ? ' is-spending' : ''}`}
          aria-label={`${contracts} Recruit Contract${contracts === 1 ? '' : 's'} available`}
        >
          {contracts <= MAX_CONTRACT_PIPS ? (
            Array.from({ length: contracts }, (_, i) => (
              <span key={i} className={`recruit-seal${canSign && i === 0 ? ' is-spending' : ''}`} aria-hidden="true">
                📜
              </span>
            ))
          ) : (
            <span className="recruit-seal" aria-hidden="true">
              📜
            </span>
          )}
          <span className="recruit-contracts-count">
            {contracts} Contract{contracts === 1 ? '' : 's'}
          </span>
        </div>

        <p className={`draft-flavor${signed ? ' is-live' : ''}`} key={signed ?? 'idle'}>
          {signed
            ? `${signed} signed on. ${contracts > 0 ? `${contracts} Contract${contracts === 1 ? '' : 's'} left.` : 'No Contracts left.'}`
            : 'A beaten champion will fight for you — for the price of one Contract.'}
        </p>
      </header>

      <div className="draft-stage">
        {stampTick > 0 && (
          <span key={stampTick} className="recruit-stamp" aria-hidden="true">
            <span className="recruit-stamp-ring" />
            <span className="recruit-stamp-mark">✦</span>
          </span>
        )}

        <StageFigure key={featured.rosterId} heroId={hero.id} heroName={hero.name} onInspect={() => setInspecting(true)}>
          <span className="recruit-level" aria-label={`Level ${featured.level}`}>
            Lv {featured.level}
          </span>
        </StageFigure>

        <div className="draft-ident" key={`${featured.rosterId}-ident`}>
          <h3 className="draft-name">{hero.name}</h3>
          <StageTypes types={rosterEntryTypes(hero, featured)} />

          {(evolutions.length > 0 || heroClass) && (
            <div className="recruit-veteran">
              {evolutions.map((path) => (
                <span key={path.id} className="recruit-veteran-mark">
                  ✦ {path.name}
                </span>
              ))}
              {heroClass && <span className="recruit-veteran-mark">◆ {heroClass.name}</span>}
            </div>
          )}

          <StageSilhouette baseStats={hero.baseStats} grants={grants} />
          <StageKit moveIds={featured.unlockedMoveIds} onPick={setPopupMove} />
        </div>

        {/* `data-sfx="none"` only while it can sign — `contract.sign` is this press's sound. Left
            off when inert so the delegated listener's disabled buzz still fires (audio/uiSfx.ts). */}
        <button
          className={`draft-choose recruit-sign${featuredClaimed ? ' chosen' : ''}`}
          data-sfx={canSign ? 'none' : undefined}
          disabled={!canSign}
          onClick={handleSign}
        >
          {featuredClaimed
            ? `✦ ${hero.name} signed`
            : contracts <= 0
              ? 'No Contracts left'
              : rosterFull
                ? `Replace a hero for ${hero.name}`
                : `Sign ${hero.name} — 1 Contract`}
        </button>
      </div>

      {offers.length > 1 && (
        <StageRail>
          {offers.map((entry) => {
            const railHero = heroes[entry.heroId];
            return (
              <StageCandidate
                key={entry.rosterId}
                heroId={railHero.id}
                heroName={railHero.name}
                primaryType={railHero.types[0]}
                featured={entry.rosterId === featured.rosterId}
                sealed={claimedRosterIds.includes(entry.rosterId)}
                onSelect={() => setFeaturedRosterId(entry.rosterId)}
              />
            );
          })}
        </StageRail>
      )}

      {/* Quiet while a signature is still possible; `is-only-option` restores the gold slab once
          this is the only live control on the screen. A required offer has no leave at all until
          it is signed — a disabled button would read as a bug rather than as a decision taken. */}
      {required && claimedRosterIds.length === 0 ? (
        <p className="recruit-required-note">This one is not optional.</p>
      ) : (
        <button
          className={`resolve-button recruit-leave${nothingLeftToSign ? ' is-only-option' : ''}`}
          onClick={onDone}
        >
          {nothingLeftToSign ? 'Continue' : claimedRosterIds.length > 0 ? 'Done Recruiting' : 'Leave Them'}
        </button>
      )}

      {popupMove && (
        <StageMovePopup move={popupMove} caster={healCasterForEntry(hero, featured)} onClose={() => setPopupMove(null)} />
      )}

      {inspecting && (
        <HeroPreviewOverlay
          hero={hero}
          entry={arriving}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setInspecting(false)}
        />
      )}

      {rosterReplaceEntry && (
        <RosterReplaceScreen
          roster={run.roster}
          candidate={{ source: 'contract', offer: deriveContractOffer(rosterReplaceEntry) }}
          relicIds={run.relics}
          onConfirm={(terminatedRosterId) => {
            const ok = onClaimReplace(rosterReplaceEntry, terminatedRosterId);
            if (ok) {
              markSigned(rosterReplaceEntry);
              setRosterReplaceEntry(null);
            }
            return ok;
          }}
          onCancel={() => setRosterReplaceEntry(null)}
        />
      )}
    </div>
  );
}
