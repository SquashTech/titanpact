import { type CSSProperties, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { equipment } from '../../data/equipment';
import { heroes } from '../../data/heroes';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { applyEvolutionMoves, availableEvolution, chooseEvolutionPath, grantOfferedMove, rosterEntryTypes } from '../../run/progression';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useLongPress } from '../shared/MoveTile';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { CrucibleChain, CrucibleVessel } from './crucibleArt';
import { EvolutionScreen } from './EvolutionScreen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** A path's granted move the four-move cap refused, waiting to be offered as a replace-or-decline. */
interface Overflow {
  rosterId: string;
  queue: string[];
}

/**
 * The Crucible (docs/growth-overhaul.md §5): pick ONE hero, and that hero evolves.
 *
 * A beat in the act-boundary chain — Guardian falls, Banner, **Crucible**, Pact Seal, act intro —
 * rather than a map row, because acts 1-4 already run nine rows and a tenth is not affordable.
 * Team, hero, run: three scales ascending. Every player learns after Act 1 that a Guardian's
 * death is where a hero changes.
 *
 * **Non-bankable.** It is a turning point, so the choice is made now, which is also why it is a
 * beat rather than an item: a grant that cannot be held is a screen anyway, so it should be one
 * the player can see coming.
 *
 * It replaced a level trigger. Under automatic roster-wide levelling every hero crosses any
 * threshold on the same fight, so \`EVOLUTION_LEVEL\` was a six-decision wall by construction —
 * the move was forced, not preferred.
 */
export function CrucibleScreen({ run, onRunChange, onContinue }: Props) {
  /** Standing at the rim — chosen, not yet committed. The Evolution screen has no way back, so this is the last look. */
  const [armedRosterId, setArmedRosterId] = useState<string | null>(null);
  const [chosenRosterId, setChosenRosterId] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<Overflow | null>(null);
  const [previewing, setPreviewing] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const chosen = chosenRosterId ? (run.roster.find((r) => r.rosterId === chosenRosterId) ?? null) : null;
  const node = chosen ? availableEvolution(progressionTable, chosen) : null;
  const overflowEntry = overflow ? (run.roster.find((r) => r.rosterId === overflow.rosterId) ?? null) : null;
  const eligible = run.roster.filter((entry) => !!availableEvolution(progressionTable, entry));

  function choose(rosterId: string, pathId: string) {
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    const path = entry ? (availableEvolution(progressionTable, entry)?.paths.find((p) => p.id === pathId) ?? null) : null;
    // Read BEFORE the choice lands: the path's moves that MOVE_CAP refused become the same
    // replace-or-decline offer a Scroll makes, one at a time.
    const refused = entry && path ? applyEvolutionMoves(entry.unlockedMoveIds, path.unlocksMoveIds).overflow : [];

    onRunChange(chooseEvolutionPath(run, progressionTable, heroes, rosterId, pathId));
    setChosenRosterId(null);
    setArmedRosterId(null);
    if (refused.length > 0) setOverflow({ rosterId, queue: refused });
    else onContinue();
  }

  function resolveOverflow(replaceMoveId: string | null, learn: boolean) {
    if (!overflow) return;
    const [moveId, ...rest] = overflow.queue;
    if (learn) onRunChange(grantOfferedMove(run, overflow.rosterId, moveId, replaceMoveId ?? undefined));
    if (rest.length > 0) {
      setOverflow({ rosterId: overflow.rosterId, queue: rest });
    } else {
      setOverflow(null);
      onContinue();
    }
  }

  // The overflow outranks everything: finish what this Evolution owes before the screen closes.
  if (overflow && overflowEntry) {
    return (
      <MoveOfferOverlay
        run={run}
        entry={overflowEntry}
        moveId={overflow.queue[0]}
        eyebrow="The path grants a move — your kit is full"
        onResolve={resolveOverflow}
      />
    );
  }

  if (chosen && node) {
    return (
      <EvolutionScreen
        hero={heroes[chosen.heroId]}
        entry={chosen}
        node={node}
        run={run}
        onChoose={(pathId) => choose(chosen.rosterId, pathId)}
      />
    );
  }

  const armedEntry = armedRosterId ? (run.roster.find((r) => r.rosterId === armedRosterId) ?? null) : null;
  const cold = eligible.length === 0;
  // Two ranks around the bowl, the nearer three closest to the fire. Depth is carried by light,
  // never by size: a 48px source scales cleanly to 96 and to nothing in between.
  const frontCount = Math.min(3, run.roster.length);
  const back = run.roster.slice(0, run.roster.length - frontCount);
  const front = run.roster.slice(run.roster.length - frontCount);

  function arm(rosterId: string) {
    playSfx('ui.select');
    setArmedRosterId(rosterId);
  }

  function enter() {
    if (!armedEntry) return;
    playSfx('ui.confirm');
    setChosenRosterId(armedEntry.rosterId);
  }

  const readout = cold
    ? 'Every hero has already walked it.'
    : armedEntry
      ? `${heroes[armedEntry.heroId].name} stands at the rim. What they become is permanent.`
      : 'Choose the hero to be remade — hold one to read its sheet first.';

  return (
    <div
      className={`node-screen crucible-screen${armedEntry ? ' is-armed' : ''}${cold ? ' is-cold' : ''}`}
      style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}
    >
      <NodeSky />
      <RosterPeek run={run} />
      <NodeHeader
        eyebrow="The Crucible"
        title={cold ? 'The fire is cold' : 'One of you changes'}
        readout={readout}
        readoutKey={armedRosterId ?? String(cold)}
        readoutLive={!!armedEntry}
      />

      {/* The scene: a bowl of molten gold, the light it throws upward, the embers it sheds, and the
          roster standing around it in two ranks. No boxes — a figure is lit by the fire and grows a
          frame only once it is the one chosen, the battlefield's own targetability idiom. */}
      <div className="crucible-stage">
        <span className="crucible-heat" aria-hidden="true" />
        <CrucibleChain side="left" />
        <CrucibleChain side="right" />
        {SMOKE.map((sm, i) => (
          <span
            key={i}
            className="crucible-smoke"
            aria-hidden="true"
            style={{ '--smoke-dur': `${sm.duration}s`, '--smoke-delay': `${sm.delay}s`, '--smoke-drift': `${sm.drift}px` } as CSSProperties}
          />
        ))}
        <div className="crucible-embers" aria-hidden="true">
          {EMBERS.map((e, i) => (
            <span
              key={i}
              className="crucible-ember"
              style={
                {
                  '--ember-x': `${e.x}%`,
                  '--ember-delay': `${e.delay}s`,
                  '--ember-dur': `${e.duration}s`,
                  '--ember-drift': `${e.drift}px`,
                  '--ember-size': `${e.size}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <div className="crucible-ranks">
          {[back, front].map((rank, r) => (
            <div key={r} className={`crucible-rank ${r === 0 ? 'is-back' : 'is-front'}`}>
              {rank.map((entry) => (
                <CrucibleFigure
                  key={entry.rosterId}
                  entry={entry}
                  pending={!!availableEvolution(progressionTable, entry)}
                  armed={entry.rosterId === armedRosterId}
                  dimmed={!!armedEntry && entry.rosterId !== armedRosterId}
                  onArm={() => arm(entry.rosterId)}
                  onPreview={() => setPreviewing({ hero: heroes[entry.heroId], entry })}
                />
              ))}
            </div>
          ))}
        </div>

        <CrucibleVessel />
      </div>

      {/* An unspent Crucible is never walked past — it does not bank, so leaving is the same as
          burning it. The button commits only once a hero stands at the rim; cold, it is the exit. */}
      {cold ? (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      ) : (
        <button className="resolve-button crucible-enter" disabled={!armedEntry} onClick={enter}>
          {armedEntry ? `Enter the Crucible — ${heroes[armedEntry.heroId].name}` : 'Choose a hero'}
        </button>
      )}

      {previewing && (
        <HeroPreviewOverlay
          hero={previewing.hero}
          entry={previewing.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}

interface FigureProps {
  entry: RosterEntry;
  /** Has an Evolution left to take. An evolved hero stands ashen and cannot be armed. */
  pending: boolean;
  armed: boolean;
  dimmed: boolean;
  onArm: () => void;
  onPreview: () => void;
}

/** One hero at the rim: figure on fire-lit ground, name, types. Tap arms; hold opens the sheet. */
function CrucibleFigure({ entry, pending, armed, dimmed, onArm, onPreview }: FigureProps) {
  const hero = heroes[entry.heroId];
  const longPress = useLongPress(onPreview, pending ? onArm : undefined);
  const classes = ['crucible-figure', pending ? '' : 'is-ashen', armed ? 'is-armed' : '', dimmed ? 'is-dimmed' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={classes}
      style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      role="button"
      tabIndex={pending ? 0 : -1}
      aria-disabled={!pending}
      aria-pressed={armed}
      aria-label={`${hero.name}, level ${entry.level} — ${pending ? 'stand at the rim' : 'already evolved'}`}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && pending) {
          e.preventDefault();
          onArm();
        }
      }}
      {...longPress}
    >
      <span className="crucible-figure-frame" aria-hidden="true" />
      <span className="crucible-figure-ground" aria-hidden="true" />
      <HeroPortrait heroId={hero.id} className="crucible-portrait" />
      <span className="crucible-figure-name">{hero.name}</span>
      <span className="crucible-figure-types">
        {rosterEntryTypes(hero, entry).map((t) => (
          <span key={t} className="pick-type-code" style={{ color: getTypeColor(t) }} title={t}>
            <ElementGlyph type={t} />
            {getTypeAbbr(t)}
          </span>
        ))}
      </span>
      {!pending && <span className="crucible-figure-ashen">Evolved</span>}
    </div>
  );
}

const SMOKE = [
  { duration: 9.7, delay: 0, drift: -60 },
  { duration: 12.3, delay: -4.1, drift: 50 },
  { duration: 14.9, delay: -8.6, drift: -15 },
];

// Golden-angle spread, the same as the Pact Seal's shards: stable, never symmetrical, no seed.
const EMBERS = Array.from({ length: 18 }, (_, i) => {
  const seed = i * 137.51;
  return {
    x: 22 + (seed % 56),
    delay: (seed * 0.37) % 7,
    duration: 4.2 + ((seed * 0.11) % 3.6),
    drift: -22 + ((seed * 0.53) % 44),
    size: 2 + ((seed * 0.07) % 2.5),
  };
});
