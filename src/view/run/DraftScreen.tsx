import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import type { HeroDefinition, MoveDefinition, PassiveDefinition } from '../../engine/content';
import { createRosterEntry } from '../../run/state';
import { STARTER_PICK_COUNT } from '../../run/draft';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { PassiveDetailOverlay } from '../shared/PassiveDossier';
import {
  StageCandidate,
  StageDais,
  StageFigure,
  StageInnate,
  StageKit,
  StageMovePopup,
  StageRail,
  StageSheet,
  StageSky,
  StageTypes,
  heroHasBurden,
} from '../shared/HeroStage';

interface Props {
  optionIds: string[];
  onConfirm: (chosenIds: string[]) => void;
}

/**
 * Start-of-run draft: pick 2 of 4 on the shared stage (shared/HeroStage.tsx). Candidates have no
 * roster entry yet, so the info-button preview synthesizes a throwaway level-1 one.
 */
export function DraftScreen({ optionIds, onConfirm }: Props) {
  const [featuredId, setFeaturedId] = useState<string>(optionIds[0]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState<HeroDefinition | null>(null);
  const [popupMove, setPopupMove] = useState<MoveDefinition | null>(null);
  const [popupPassive, setPopupPassive] = useState<PassiveDefinition | null>(null);
  /** Keyed by a rising counter so remounting replays the mount-once flare; `final` marks the pact-completing bind. */
  const [bindFlare, setBindFlare] = useState<{ tick: number; final: boolean } | null>(null);

  const featured = rosterHeroes[featuredId];
  const featuredRgb = getTypeColorRgb(featured.types[0]);
  const caster = { wisdom: featured.baseStats.wisdom, types: featured.types, stats: featured.baseStats };
  const featuredChosen = pickedIds.includes(featuredId);
  const pactFull = pickedIds.length >= STARTER_PICK_COUNT;
  // `toggle` picks the real sound, so the delegated listener stays silent — except when the button
  // is inert, where leaving the attribute off lets its disabled buzz fire (audio/uiSfx.ts resolveSfx).
  const chooseSfx = !featuredChosen && pactFull ? undefined : 'none';
  const complete = pickedIds.length === STARTER_PICK_COUNT;

  // Clears the flare first: StageFigure is keyed on the featured hero, and a remount would replay
  // a live flare around whoever was tapped next.
  function feature(heroId: string) {
    setBindFlare(null);
    setFeaturedId(heroId);
  }

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
        <div className="draft-sockets" aria-label={`${pickedIds.length} of ${STARTER_PICK_COUNT} allies chosen`}>
          {Array.from({ length: STARTER_PICK_COUNT }, (_, i) => {
            const id = pickedIds[i];
            const hero = id ? rosterHeroes[id] : null;
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
        <StageDais>
          {/* Keyed on the featured hero so switching remounts the figure and replays its arrival. */}
          <StageFigure key={featuredId} heroId={featured.id} heroName={featured.name} onInspect={() => setInspecting(featured)}>
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
            <StageSheet baseStats={featured.baseStats} burden={heroHasBurden(featured)} />
          </div>
        </StageDais>

        {/* The innate ahead of the kit: the one line the pick turns on, read whole (docs/innate-passives.md §6). */}
        <StageInnate key={`${featuredId}-innate`} hero={featured} onOpen={setPopupPassive} />

        {/* Keyed too, so the rows arrive with the hero as the fight's console does with the turn. */}
        <StageKit key={`${featuredId}-kit`} moveIds={featured.moveIds} caster={caster} onPick={setPopupMove} />

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
          const hero = rosterHeroes[heroId];
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
        <StageMovePopup move={popupMove} caster={caster} onClose={() => setPopupMove(null)} />
      )}
      <PassiveDetailOverlay passive={popupPassive} onClose={() => setPopupPassive(null)} />

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
