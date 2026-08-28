import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import type { HeroDefinition, MoveDefinition } from '../../engine/content';
import { createRosterEntry } from '../../run/state';
import { STARTER_PICK_COUNT } from '../../run/draft';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
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

interface Props {
  optionIds: string[];
  onConfirm: (chosenIds: string[]) => void;
}

/**
 * Start-of-run draft: pick 2 of 4 random candidates (App.tsx's opening
 * screen, replacing a fixed cinderKnight+tidecaller opener — CLAUDE.md
 * "every hero must be viable", so runs shouldn't always begin identically).
 *
 * Rebuilt 2026-08-25 as a *stage* rather than a grid of cards, applying
 * docs/visual-language.md's rule ("a rectangle means you can act on this")
 * outside combat for the first time — its open item 6. The old screen spent
 * 227px on a flavor banner and then showed each candidate as a 158x112 card
 * carrying a 40px sprite, a name and two type chips: nothing to look at and
 * nothing to decide with, so the pick was uninformed unless the player dug
 * through the info overlay. It read, accurately, as clicking boxes.
 *
 * Now one candidate at a time stands at 144px (a clean 3x of the 48px
 * sources — the scale docs/visual-language.md item 5 wanted to try and could
 * never afford on a battlefield holding four figures) inside a summoning
 * sigil, with the stat silhouette and starting kit that actually inform the
 * choice. The rail below is the roster of candidates; tapping one brings it
 * to the stage, and the stage's own button is what commits. Two taps per
 * pick, on the most consequential decision of the run — the ceremony is the
 * point.
 *
 * The stage itself now lives in shared/HeroStage.tsx: the Recruit Contract
 * claim (RecruitScreen) asks the same question about the same kind of
 * figure, so it stands on the same ground rather than reimplementing it.
 * What stays here is what only the draft has — the pact sockets and the
 * two-pick commit.
 *
 * Candidates are unrecruited (no roster entry yet), so the info-button
 * preview synthesizes a throwaway level-1 RosterEntry the same way
 * SquadSelectScreen does for real roster members.
 */
export function DraftScreen({ optionIds, onConfirm }: Props) {
  const [featuredId, setFeaturedId] = useState<string>(optionIds[0]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState<HeroDefinition | null>(null);
  /** The starting move whose detail popup is open over the stage, or null. Tapping a kit chip opens it; a tap anywhere dismisses it. */
  const [popupMove, setPopupMove] = useState<MoveDefinition | null>(null);

  const featured = heroes[featuredId];
  const featuredRgb = getTypeColorRgb(featured.types[0]);
  const featuredChosen = pickedIds.includes(featuredId);
  const pactFull = pickedIds.length >= STARTER_PICK_COUNT;
  const complete = pickedIds.length === STARTER_PICK_COUNT;

  function toggle(heroId: string) {
    setPickedIds((prev) => {
      if (prev.includes(heroId)) return prev.filter((id) => id !== heroId);
      if (prev.length >= STARTER_PICK_COUNT) return prev;
      return [...prev, heroId];
    });
  }

  return (
    <div className="draft-screen" style={{ '--pact-rgb': featuredRgb } as CSSProperties}>
      <StageSky />

      <header className="draft-header">
        <div className="draft-eyebrow">A Titan Stirs</div>
        <h2 className="draft-title">
          <span className="draft-title-glow" aria-hidden="true">
            Forge Your Pact
          </span>
          Forge Your Pact
        </h2>
        <p className="draft-flavor">Two will carry a fraction of its power. Choose them.</p>
        {/* The pick counter as two sockets that fill with the chosen hero's own
            sprite, rather than an "(n/2)" in a section heading. Same pip-track
            idiom as the Field Effect plaque's duration clock: a fixed
            denominator the player learns the shape of once. */}
        <div className="draft-sockets" aria-label={`${pickedIds.length} of ${STARTER_PICK_COUNT} allies chosen`}>
          {Array.from({ length: STARTER_PICK_COUNT }, (_, i) => {
            const id = pickedIds[i];
            const hero = id ? heroes[id] : null;
            return (
              <span
                key={i}
                className={`draft-socket${hero ? ' filled' : ''}`}
                style={hero ? ({ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties) : undefined}
                title={hero?.name}
              >
                {hero ? (
                  <HeroPortrait heroId={hero.id} className="draft-socket-portrait" />
                ) : (
                  <span className="draft-socket-mark" aria-hidden="true">
                    ◆
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </header>

      <div className="draft-stage">
        {/* Keyed on the featured hero so switching candidates remounts the
            figure and replays its arrival. */}
        <StageFigure key={featuredId} heroId={featured.id} heroName={featured.name} onInspect={() => setInspecting(featured)} />

        <div className="draft-ident" key={`${featuredId}-ident`}>
          <h3 className="draft-name">{featured.name}</h3>
          <StageTypes types={featured.types} />
          <StageSilhouette baseStats={featured.baseStats} />
          <StageKit moveIds={featured.moveIds} onPick={setPopupMove} />
        </div>

        <button
          className={`draft-choose${featuredChosen ? ' chosen' : ''}`}
          disabled={!featuredChosen && pactFull}
          onClick={() => toggle(featuredId)}
        >
          {featuredChosen ? `✦ ${featured.name} is bound` : pactFull ? 'Pact is full' : `Choose ${featured.name}`}
        </button>
      </div>

      <StageRail>
        {optionIds.map((heroId) => {
          const hero = heroes[heroId];
          return (
            <StageCandidate
              key={heroId}
              heroId={hero.id}
              heroName={hero.name}
              primaryType={hero.types[0]}
              featured={heroId === featuredId}
              sealed={pickedIds.includes(heroId)}
              onSelect={() => setFeaturedId(heroId)}
            />
          );
        })}
      </StageRail>

      <button className="resolve-button draft-cta" disabled={!complete} onClick={() => onConfirm(pickedIds)}>
        {complete ? 'Seal the Pact' : `Choose ${STARTER_PICK_COUNT - pickedIds.length} more`}
      </button>

      {popupMove && <StageMovePopup move={popupMove} onClose={() => setPopupMove(null)} />}

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting}
          entry={createRosterEntry(inspecting.id, inspecting.id, inspecting.moveIds)}
          equipmentLookup={{}}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}
