import { useState, type CSSProperties } from 'react';
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

/** Contracts owned are drawn as seal pips up to this many; past it the track collapses to a single seal and a count, since twelve pips stop being countable at a glance. */
const MAX_CONTRACT_PIPS = 6;

interface Props {
  /** The player's run — the contracts being spent, the roster being added to, and the relics the recruit will inherit once they join. */
  run: RunState;
  /**
   * The beaten heroes this win puts on offer (App.tsx handleFightResolved,
   * via recruitment.ts pickContractOffers). Sampled once by the caller and
   * held in Screen state, so re-renders here can't reshuffle who is offered.
   */
  offers: readonly RosterEntry[];
  /** Spends one contract and adds the hero. Returns whether it succeeded (false only if the run's contracts ran out between render and tap). */
  onClaim: (defeated: RosterEntry) => boolean;
  /** Roster-full variant, wired to the in-place RosterReplaceScreen below. */
  onClaimReplace: (defeated: RosterEntry, terminatedRosterId: string) => boolean;
  /** Leave for the map — whether or not anything was claimed. */
  onDone: () => void;
}

/**
 * The Recruit Contract claim (CLAUDE.md "claim a beaten hero"), as its own
 * screen.
 *
 * It used to be a band inside FightScreen's victory box: two 56px portraits
 * under a line of text, stacked below the gold/XP chips and an equipment
 * spotlight, inside a panel the player reads as "the fight is over." Adding
 * a hero to a six-slot roster for the rest of the run was presented as a
 * smaller decision than the item drop above it, and the price — one of a
 * currency the player might hold exactly one of all run — was a number in an
 * eyebrow.
 *
 * So it stands on the draft's stage instead (shared/HeroStage.tsx): the same
 * 144px figure in the same sigil, the same stat silhouette and movepool, the
 * same rail. The draft and this screen ask one question — *do you want this
 * hero, permanently, for a price* — and now they ask it the same way. What is
 * different is what the draft has no equivalent of and this screen must make
 * unmissable: the contract track, which counts what the player owns in seals
 * and dims the one about to be spent.
 *
 * The screen is skipped entirely when the player holds no contracts — App.tsx
 * never opens it, since an offer that cannot be taken is a tap that only
 * teaches the player their taps are decorative.
 *
 * A veteran arrives with their Evolutions and unlocked moves intact but their
 * gear stripped (recruitment.ts deriveContractOffer), so everything drawn
 * here — silhouette, kit, hero sheet — reads off an ungeared copy of the
 * entry rather than the enemy build that just fought, which would advertise a
 * weapon that does not come with them.
 */
export function RecruitScreen({ run, offers, onClaim, onClaimReplace, onDone }: Props) {
  const [featuredRosterId, setFeaturedRosterId] = useState<string>(offers[0].rosterId);
  const [claimedRosterIds, setClaimedRosterIds] = useState<string[]>([]);
  const [popupMove, setPopupMove] = useState<MoveDefinition | null>(null);
  const [inspecting, setInspecting] = useState(false);
  /** The offer a roster-full claim is trying to sign — opens RosterReplaceScreen over this screen rather than as its own App Screen, so leaving and coming back can't lose which offers are already signed. */
  const [rosterReplaceEntry, setRosterReplaceEntry] = useState<RosterEntry | null>(null);
  /** The last hero signed, for the header's live readout. */
  const [signed, setSigned] = useState<string | null>(null);

  const featured = offers.find((entry) => entry.rosterId === featuredRosterId) ?? offers[0];
  /** What actually arrives: the veteran's build minus the gear that doesn't carry over. */
  const arriving: RosterEntry = { ...featured, equipment: createEmptyLoadout() };
  const hero = heroes[featured.heroId];
  const featuredClaimed = claimedRosterIds.includes(featured.rosterId);
  const contracts = run.recruitContracts;
  const rosterFull = run.roster.length >= ROSTER_CAP;
  const allClaimed = claimedRosterIds.length >= offers.length;
  const canSign = contracts > 0 && !featuredClaimed;

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

  /** Marks an offer signed and moves the stage on to whoever is still available, so a second contract doesn't need a rail tap to spend. */
  function markSigned(entry: RosterEntry) {
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

        {/* The price, counted out. Same fixed-denominator pip idiom as the
            draft's pact sockets, except the denominator here is what the
            player owns — so the track both answers "how many do I have" and,
            by dimming the leftmost seal the moment a signable hero is on
            stage, shows which one this signature costs. */}
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
        <StageFigure key={featured.rosterId} heroId={hero.id} heroName={hero.name} onInspect={() => setInspecting(true)}>
          <span className="recruit-level" aria-label={`Level ${featured.level}`}>
            Lv {featured.level}
          </span>
        </StageFigure>

        <div className="draft-ident" key={`${featured.rosterId}-ident`}>
          <h3 className="draft-name">{hero.name}</h3>
          <StageTypes types={rosterEntryTypes(hero, featured)} />

          {/* What a veteran brings that a drafted rookie cannot: the branches
              they already took. "Arrives with branches partially locked"
              (CLAUDE.md) is the whole character of this acquisition path, and
              it was previously invisible until the hero was already on the
              roster. */}
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

        <button
          className={`draft-choose recruit-sign${featuredClaimed ? ' chosen' : ''}`}
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

      {/* Only drawn for a second offer: a rail of one is a button that
          switches to what is already on stage. */}
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

      <button className="resolve-button recruit-leave" onClick={onDone}>
        {allClaimed || contracts <= 0 ? 'Continue' : claimedRosterIds.length > 0 ? 'Done Recruiting' : 'Leave Them'}
      </button>

      {popupMove && <StageMovePopup move={popupMove} onClose={() => setPopupMove(null)} />}

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
