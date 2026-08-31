import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
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
  /**
   * The binding flare over the stage: a monotonically rising counter used as
   * a React key, plus whether that bind completed the pact.
   *
   * A counter rather than a boolean-and-a-timer because the flare is a
   * mount-once animation (same idiom as `.growth-charge` and the title
   * screen's shockwave) — remounting it is what replays it, so binding the
   * second starter can't inherit the first one's half-finished flare, and
   * nothing has to clean up after it.
   */
  const [bindFlare, setBindFlare] = useState<{ tick: number; final: boolean } | null>(null);

  const featured = heroes[featuredId];
  const featuredRgb = getTypeColorRgb(featured.types[0]);
  const featuredChosen = pickedIds.includes(featuredId);
  const pactFull = pickedIds.length >= STARTER_PICK_COUNT;
  /**
   * The commit button's sound is chosen in `toggle` (three outcomes, one
   * button), so the delegated listener must stay out of the way — except
   * when the button is inert, which `toggle` never runs for. Leaving the
   * attribute off in that one case lets the listener's own disabled rule
   * supply the refusal buzz; `data-sfx="none"` would win over it and the
   * press would go silent. See audio/uiSfx.ts resolveSfx.
   */
  const chooseSfx = !featuredChosen && pactFull ? undefined : 'none';
  const complete = pickedIds.length === STARTER_PICK_COUNT;

  /**
   * Bring a candidate to the stage. Clears any binding flare first: the
   * flare is drawn inside `StageFigure`, which is keyed on the featured
   * hero, so a live one would be remounted — and replayed — around whoever
   * the player tapped next. The flare belongs to the bind that just
   * happened, not to the stage it happened on.
   */
  function feature(heroId: string) {
    setBindFlare(null);
    setFeaturedId(heroId);
  }

  /**
   * Bind or release the featured candidate.
   *
   * The button silences the delegated click sound (see `chooseSfx`) because
   * a bind is not a tap: this decides between two different sounds, and the
   * listener firing `ui.tap` underneath either would blur the one that
   * matters. Releasing gets `ui.back` — the inverse of a commitment is a
   * cancel, which is exactly what that sound already means everywhere else.
   *
   * The pact-completing bind is the same sound pitched down and pushed a
   * little louder rather than a second sound of its own. The two binds are
   * the same act; the second one is just the one that finishes it, and a
   * different sound would say they were different in kind.
   */
  function toggle(heroId: string) {
    if (pickedIds.includes(heroId)) {
      playSfx('ui.back');
      setPickedIds((prev) => prev.filter((id) => id !== heroId));
      return;
    }
    if (pickedIds.length >= STARTER_PICK_COUNT) return;
    const final = pickedIds.length + 1 === STARTER_PICK_COUNT;
    playSfx('pact.bind', final ? { pitch: 0.92, gain: 1.2 } : {});
    setBindFlare((prev) => ({ tick: (prev?.tick ?? 0) + 1, final }));
    setPickedIds((prev) => [...prev, heroId]);
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
        <StageFigure key={featuredId} heroId={featured.id} heroName={featured.name} onInspect={() => setInspecting(featured)}>
          {/* The bind itself: a ring closing inward onto the figure, in the
              candidate's own type colour (`--pact-rgb`, already set on the
              screen root). Inward, not outward — every other burst in the app
              expands, because every other burst is something being released,
              and this is the one moment that is something being *caught*.
              ┄
              Drawn inside the figure rather than beside it so it centres on
              the summoning sigil at any viewport height; `feature()` is what
              keeps the figure's remount from replaying it. */}
          {bindFlare && (
            <span
              key={bindFlare.tick}
              className={`draft-bind-flare${bindFlare.final ? ' is-final' : ''}`}
              aria-hidden="true"
            />
          )}
        </StageFigure>

        <div className="draft-ident" key={`${featuredId}-ident`}>
          <h3 className="draft-name">{featured.name}</h3>
          <StageTypes types={featured.types} />
          <StageSilhouette baseStats={featured.baseStats} />
          <StageKit moveIds={featured.moveIds} onPick={setPopupMove} />
        </div>

        <button
          className={`draft-choose${featuredChosen ? ' chosen' : ''}`}
          data-sfx={chooseSfx}
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
              onSelect={() => feature(heroId)}
            />
          );
        })}
      </StageRail>

      <button className="resolve-button draft-cta" disabled={!complete} onClick={() => onConfirm(pickedIds)}>
        {complete ? 'Seal the Pact' : `Choose ${STARTER_PICK_COUNT - pickedIds.length} more`}
      </button>

      {popupMove && (
        <StageMovePopup
          move={popupMove}
          caster={{ wisdom: featured.baseStats.wisdom, types: featured.types }}
          onClose={() => setPopupMove(null)}
        />
      )}

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
