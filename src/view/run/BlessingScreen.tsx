import { useEffect, useRef, useState } from 'react';
import { rosterHeroes } from '../../data/content';
import { playSfx } from '../../audio/sfx';
import type { RunState } from '../../run/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import { formIdFor } from '../../run/progression';
import { prefersReducedMotion } from '../shared/reducedMotion';
import blessingBackdrop from '../../../art/backdrops/blessing.png';
import pactwardenArt from '../../../art/npc/pactwarden.png';

// The run's Blessing (docs/blessings-and-statuses.md §1.5): after the Titan wakes, the Pactwarden
// blesses the opening pair at the stones where the road begins. One line, one light, and on.

const LINE = 'I bless you for this journey. You may need it.';
/** Per character (ms) — RoadEncounter's pace. */
const TYPE_MS = 24;
/** The fade in before she speaks (ms), RoadEncounter's `road-encounter-arrive`. */
const ARRIVE_MS = 900;
/** The light falling and settling, before a tap moves on (ms). Matches `blessing-shaft`. */
const BLESS_MS = 1300;

type Phase = 'arrive' | 'speak' | 'bless' | 'blessed';

export function BlessingScreen({ run, onDone }: { run: RunState; onDone: () => void }) {
  const instant = prefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(instant ? 'speak' : 'arrive');
  const [shown, setShown] = useState(instant ? LINE.length : 0);
  const typed = shown >= LINE.length;
  // Through a ref: the parent rebuilds `onDone` on its own renders (TitanRiseScreen's note).
  const done = useRef(onDone);
  done.current = onDone;
  const [left, right] = run.roster;

  useEffect(() => {
    if (phase !== 'arrive') return;
    const t = window.setTimeout(() => setPhase('speak'), ARRIVE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'speak' || typed) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), TYPE_MS);
    return () => window.clearTimeout(t);
  }, [phase, typed, shown]);

  useEffect(() => {
    if (phase !== 'bless') return;
    playSfx('blessing');
    const t = window.setTimeout(() => setPhase('blessed'), instant ? 0 : BLESS_MS);
    return () => window.clearTimeout(t);
  }, [phase, instant]);

  function advance() {
    if (phase === 'arrive' || (phase === 'speak' && !typed)) {
      setPhase('speak');
      setShown(LINE.length);
      return;
    }
    if (phase === 'speak') {
      setPhase('bless');
      return;
    }
    if (phase === 'bless') {
      setPhase('blessed');
      return;
    }
    playSfx('ui.confirm');
    done.current();
  }

  const lit = phase === 'bless' || phase === 'blessed';
  const names = [left, right].flatMap((entry) => (entry ? [rosterHeroes[entry.heroId]?.name ?? entry.heroId] : []));
  const blessedLine = `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} Blessed. ${names.length > 1 ? 'Each' : 'It'} will shrug off the first blow that would knock it out.`;
  return (
    <button
      type="button"
      className={`road-encounter blessing-rite is-${phase}${instant ? ' is-still' : ''}`}
      onClick={advance}
      data-sfx="none"
      aria-label={`The Pactwarden: ${LINE}`}
    >
      <img src={blessingBackdrop} className="road-encounter-scene" alt="" draggable={false} />
      <span className="road-encounter-shade" aria-hidden="true" />
      <img src={pactwardenArt} className="road-encounter-figure blessing-warden" alt="" draggable={false} />
      {[left, right].map((entry, i) =>
        entry ? (
          <span key={entry.rosterId} className={`blessing-hero ${i === 0 ? 'is-left' : 'is-right'}${lit ? ' is-lit' : ''}`} aria-hidden="true">
            <span className="blessing-shaft" />
            <span className="blessing-rim" />
            <HeroPortrait heroId={entry.heroId} pathId={formIdFor(entry)} className="blessing-hero-figure" />
          </span>
        ) : null
      )}
      <span className={`road-encounter-speech${phase === 'speak' ? ' is-open' : ''}`} aria-hidden="true">
        <span className="road-encounter-name">The Pactwarden</span>
        <span className="road-encounter-line">
          {LINE.slice(0, shown)}
          <span className="road-encounter-rest">{LINE.slice(shown)}</span>
        </span>
        {typed && <span className="road-encounter-more" />}
      </span>
      {/* What the light did, said where it happened rather than on the map after. */}
      <span className={`road-encounter-speech${phase === 'blessed' ? ' is-open' : ''}`} aria-hidden="true">
        <span className="road-encounter-name">Blessed</span>
        <span className="road-encounter-line">{blessedLine}</span>
        <span className="road-encounter-more" />
      </span>
    </button>
  );
}
