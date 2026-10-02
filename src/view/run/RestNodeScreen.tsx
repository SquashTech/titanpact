import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { levelOf } from '../../run/growth';
import type { RosterEntry, RunState } from '../../run/state';
import { anyWounded, mendRoster } from '../../run/wounds';
import { statScaleFor } from '../../run/statScale';
import { HeroPortrait } from '../shared/HeroPortrait';
import { currentEvolutionPathId } from '../../run/progression';
import { useLongPress } from '../shared/MoveTile';
import { NodeMotes, NODE_TINT_VITAL } from '../shared/NodeStage';
import { WoundBar, entryHp } from '../shared/WoundBar';
import { PROP_LIGHTS, SceneLights } from '../shared/SceneLights';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import campArt from '../../../art/map-nodes/awake/restReward.png';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** One hero by the fire: its figure, its name, and its bar where the act left it. A hold reads its sheet. */
function CampFigure({
  hero,
  entry,
  hp,
  maxHp,
  healed,
  onPreview,
}: {
  hero: HeroDefinition;
  entry: RosterEntry;
  hp: number;
  maxHp: number;
  /** What the rest just gave back, floated up once over the figure. */
  healed: number | null;
  onPreview: () => void;
}) {
  const longPress = useLongPress(onPreview);
  return (
    <div
      className={`camp-figure${entry.down ? ' is-down' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${hero.name}, level ${levelOf(entry)} — ${entry.down ? 'down' : `${hp} of ${maxHp} HP`}`}
      data-sfx="none"
      {...longPress}
    >
      <span className="camp-figure-glow" aria-hidden="true" />
      <HeroPortrait heroId={hero.id} pathId={currentEvolutionPathId(entry)} className="camp-portrait" />
      {healed ? (
        <span className="camp-heal" aria-hidden="true">
          +{healed}
        </span>
      ) : null}
      <span className="camp-name">{hero.name}</span>
      {entry.down ? <span className="camp-down">Down</span> : <WoundBar hp={hp} maxHp={maxHp} figure className="camp-hp" />}
    </div>
  );
}

/**
 * The Rest (docs/run-loop.md "Wounds", 2026-09-15, per user direction): the whole roster made
 * whole, in the seat a reward row would otherwise have given to gear, Scrolls or a Boon. No
 * decision on the screen — the decision was the tile — so it is a scene with a beat: the company
 * around the woken camp with every bar where the act left it, one press, the fire flares, every
 * bar sweeps full with what it got back floating over it, and the downed stand up.
 */
export function RestNodeScreen({ run, onRunChange, onContinue }: Props) {
  const [healed, setHealed] = useState<Record<string, number> | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const wounded = anyWounded(run);
  const rested = healed !== null;

  useEffect(() => {
    playSfx('shrine', { pitch: 0.8, delay: 0.12 });
  }, []);

  function handleRest() {
    playSfx('blessing');
    const gained: Record<string, number> = {};
    for (const entry of run.roster) {
      const { hp, maxHp } = entryHp(rosterHeroes[entry.heroId], entry, run.relics);
      gained[entry.rosterId] = maxHp - hp;
    }
    onRunChange(mendRoster(run));
    setHealed(gained);
  }

  // Two rows around the fire, the nearer three in front.
  const frontCount = Math.min(3, run.roster.length);
  const back = run.roster.slice(0, run.roster.length - frontCount);
  const front = run.roster.slice(run.roster.length - frontCount);

  const line = rested ? 'Every wound closes. The company is whole again.' : wounded ? 'Sit by the fire, and every wound the act has left closes.' : 'Nobody is hurt. The fire is warm all the same.';

  return (
    <div className={`node-screen rite-screen is-camp rest-screen${rested ? ' is-rested' : ''}`} style={{ '--node-rgb': NODE_TINT_VITAL, '--rite-color': '#ff9a3c' } as CSSProperties}>
      <span className="node-sky camp-ground" aria-hidden="true" />
      <NodeMotes count={16} />

      <header className="rite-head">
        <span className="rite-place camp-fire">
          <span className="rite-pool" aria-hidden="true" />
          <img src={campArt} className="rite-place-art" alt="" draggable={false} />
          <SceneLights lights={PROP_LIGHTS.restReward} />
          <span className="camp-flare" aria-hidden="true" />
        </span>
        <span className="rite-eyebrow">Embers Banked</span>
        <h2 className="rite-name">A Quiet Camp</h2>
        <p className="camp-line" key={rested ? 'rested' : 'idle'}>
          {line}
        </p>
      </header>

      <div className="camp-ranks">
        {[back, front].map((rank, r) => (
          <div key={r} className={`camp-rank${r === 0 ? ' is-back' : ''}`}>
            {rank.map((entry) => {
              const hero = rosterHeroes[entry.heroId];
              const { hp, maxHp } = entryHp(hero, entry, run.relics);
              return (
                <CampFigure
                  key={entry.rosterId}
                  hero={hero}
                  entry={entry}
                  hp={hp}
                  maxHp={maxHp}
                  healed={healed?.[entry.rosterId] || null}
                  onPreview={() => setPreviewEntry({ hero, entry })}
                />
              );
            })}
          </div>
        ))}
      </div>

      {rested || !wounded ? (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      ) : (
        <button className="resolve-button" onClick={handleRest}>
          Rest
        </button>
      )}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
