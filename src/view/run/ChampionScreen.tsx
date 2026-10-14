// The run's last screen before the summary (docs/titan-eyes.md §7, per user direction): the Titan's
// Eyes have closed and the Titan is bound (TitanBoundScreen says so), and the roster is
// presented one hero at a time — the champion's hall — before standing together as the heroes
// of the land. A hero whose form earned a star lights it on its beat; the hall then gathers every
// star the run paid into the balance. Tap advances a hero early, or skips the gathering.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { levelOf } from '../../run/growth';
import { rosterEntryTypes, formIdFor } from '../../run/progression';
import { cycleOf } from '../../run/cycles';
import type { RunState } from '../../run/state';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { evolutionName } from './evolutionName';
import { PlateButton } from '../shared/PlateButton';
import type { EarnedStar, VictoryStars } from './victoryStars';

interface Props {
  run: RunState;
  /** What recording this run will add to the profile; null draws the hall without the gathering. */
  stars: VictoryStars | null;
  onContinue: () => void;
}

/** One hero's presentation, ms. */
const HERO_MS = 2600;
/** A beat that lights a star holds this much longer. */
const STAR_BEAT_MS = 1100;
/** When the star lights on a hero's beat, ms in. */
const STAR_LIGHT_MS = 1000;
/** A re-coloured star turns from its old Cycle to the new one this long after lighting. */
const STAR_TURN_MS = 600;
/** The hall's cells have all risen by about here; the gathering starts after. */
const TALLY_START_MS = 1500;
const TALLY_STEP_MS = 520;
/** A flying star's travel, matched to `.champion-flyer`'s animation. */
const FLY_MS = 480;

const GOLD_RGB = '224, 166, 60';

/** Motes rising through the light, placed by a fixed spread so every beat draws the same air. */
function ChampionMotes({ count }: { count: number }) {
  return (
    <span className="champion-motes" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const across = (i * 61.8) % 100;
        const lag = (i * 0.37) % 3.2;
        return (
          <span
            key={i}
            className="champion-mote"
            style={{ left: `${across}%`, animationDelay: `${lag}s`, animationDuration: `${3.2 + ((i * 17) % 10) / 5}s`, '--size': `${2 + (i % 3)}px` } as CSSProperties}
          />
        );
      })}
    </span>
  );
}

/** The star a beat lights: a re-coloured one shows its old Cycle first and turns. */
function BeatStar({ star }: { star: EarnedStar }) {
  return (
    <span className={`champion-star${star.fromCycle > 0 ? ' is-raised' : ''}`} aria-hidden="true">
      <span className="champion-star-burst" />
      {star.fromCycle > 0 && <span className={`champion-star-glyph is-old star-cycle-${star.fromCycle}`}>★</span>}
      <span className={`champion-star-glyph star-cycle-${star.cycle}`}>★</span>
    </span>
  );
}

/** A hero's highest star this run, the one its beat lights. */
function topStar(earned: readonly EarnedStar[] | undefined): EarnedStar | null {
  return earned && earned.length > 0 ? earned.reduce((a, b) => (b.cycle > a.cycle ? b : a)) : null;
}

const CYCLE_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

type TallyStep =
  | { kind: 'hero'; rosterId: string; add: number }
  | { kind: 'companion'; type: string; add: number }
  | { kind: 'bonus'; add: number };

function tallySteps(run: RunState, stars: VictoryStars): TallyStep[] {
  const steps: TallyStep[] = [];
  for (const entry of run.roster) {
    const earned = stars.byRosterId[entry.rosterId];
    if (earned) steps.push({ kind: 'hero', rosterId: entry.rosterId, add: earned.filter((s) => s.fromCycle === 0).length });
  }
  if (stars.companion) steps.push({ kind: 'companion', type: stars.companion.type, add: stars.companion.fromCycle === 0 ? 1 : 0 });
  if (stars.clearBonus > 0) steps.push({ kind: 'bonus', add: stars.clearBonus });
  return steps;
}

interface Flyer {
  key: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  cycle: number;
}

/** The hall's gathering: each star the run paid flies from its hero into the balance, then the Cycle's clear bonus counts in. */
function useTally(run: RunState, stars: VictoryStars | null, active: boolean) {
  const steps = stars ? tallySteps(run, stars) : [];
  const [reached, setReached] = useState(-1);
  const [shown, setShown] = useState(stars?.balanceBefore ?? 0);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [settled, setSettled] = useState(!stars || steps.length === 0);
  const hallRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const cellStarRefs = useRef(new Map<string, HTMLElement>());

  const skip = () => {
    if (!stars || settled) return;
    setReached(steps.length - 1);
    setFlyers([]);
    setShown(stars.balanceAfter);
    setSettled(true);
    playSfx('star.reveal');
  };

  useEffect(() => {
    if (!active || !stars || settled) return;
    if (prefersReducedMotion()) {
      setReached(steps.length - 1);
      setShown(stars.balanceAfter);
      setSettled(true);
      return;
    }
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    let t = TALLY_START_MS;
    let running = stars.balanceBefore;
    let flyKey = 0;
    steps.forEach((step, i) => {
      const from = running;
      running += step.add;
      at(t, () => {
        setReached(i);
        if (step.kind === 'hero') {
          const earned = stars.byRosterId[step.rosterId] ?? [];
          const top = Math.max(...earned.map((s) => s.cycle));
          if (step.add === 0) {
            playSfx('star.lock', { pitch: 1.2, gain: 0.7 });
            return;
          }
          playSfx('star.rise', { pitch: 1 + i * 0.06 });
          const hall = hallRef.current;
          const cellStar = cellStarRefs.current.get(step.rosterId);
          const count = countRef.current;
          if (hall && cellStar && count) {
            // The canvas is transform-scaled; positions are read in its own units.
            const box = hall.getBoundingClientRect();
            const scale = box.width / hall.offsetWidth || 1;
            const a = cellStar.getBoundingClientRect();
            const b = count.getBoundingClientRect();
            const x = (a.left + a.width / 2 - box.left) / scale;
            const y = (a.top + a.height / 2 - box.top) / scale;
            const dx = (b.left + b.width / 2 - box.left) / scale - x;
            const dy = (b.top + b.height / 2 - box.top) / scale - y;
            const key = flyKey++;
            setFlyers((list) => [...list, { key, x, y, dx, dy, cycle: top }]);
            window.setTimeout(() => setFlyers((list) => list.filter((f) => f.key !== key)), FLY_MS + 40);
          }
          window.setTimeout(() => {
            setShown(from + step.add);
            playSfx('star.tick', { pitch: 1.1 + i * 0.08, gain: 1 });
          }, FLY_MS);
          return;
        }
        if (step.kind === 'companion') {
          playSfx('star.rise', { pitch: 1.2 });
          if (step.add > 0) {
            window.setTimeout(() => {
              setShown(from + step.add);
              playSfx('star.tick', { pitch: 1.4 });
            }, 240);
          }
          return;
        }
        // The clear bonus counts in rather than jumping: twelve ticks at most, however large.
        playSfx('star.charge');
        const ticks = Math.min(step.add, 12);
        for (let k = 1; k <= ticks; k++) {
          window.setTimeout(() => {
            setShown(from + Math.round((step.add * k) / ticks));
            playSfx('star.tick', { pitch: 0.9 + (k / ticks) * 0.8, gain: 0.6 + (k / ticks) * 0.5 });
          }, 420 + k * 60);
        }
      });
      t += step.kind === 'bonus' ? 420 + Math.min(step.add, 12) * 60 + 200 : TALLY_STEP_MS + (step.kind === 'hero' ? FLY_MS - 200 : 0);
    });
    at(t + 200, () => {
      setShown(stars.balanceAfter);
      setSettled(true);
      playSfx('star.reveal');
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
    // The schedule runs once, when the hall opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { steps, reached, shown, flyers, settled, skip, hallRef, countRef, cellStarRefs };
}

export function ChampionScreen({ run, stars, onContinue }: Props) {
  // roster.length is the hall with everyone in it.
  const [index, setIndex] = useState(0);
  const roster = run.roster;
  const done = index >= roster.length;
  const tally = useTally(run, stars, done);

  const entry = index >= 0 && index < roster.length ? roster[index] : null;
  const beatStar = entry ? topStar(stars?.byRosterId[entry.rosterId]) : null;

  useEffect(() => {
    if (done) {
      playSfx('victory');
      return;
    }
    if (prefersReducedMotion()) {
      setIndex(roster.length);
      return;
    }
    playSfx('pact.bind');
    const timers = [window.setTimeout(() => setIndex((i) => i + 1), HERO_MS + (beatStar ? STAR_BEAT_MS : 0))];
    if (beatStar) {
      timers.push(window.setTimeout(() => playSfx('star.earn', { pitch: 0.9 + beatStar.cycle * 0.06 }), STAR_LIGHT_MS));
      if (beatStar.fromCycle > 0) timers.push(window.setTimeout(() => playSfx('star.lock'), STAR_LIGHT_MS + STAR_TURN_MS));
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
    // Keyed on the beat alone: the stars are fixed for the screen's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, done, roster.length]);


  const hero = entry ? rosterHeroes[entry.heroId] : null;
  const pactRgb = hero ? getTypeColorRgb(hero.types[0]) : GOLD_RGB;
  const form = entry ? evolutionName(entry) : null;

  return (
    <div
      className={`champion-screen${done ? ' is-hall' : ''}`}
      style={{ '--pact-rgb': pactRgb } as CSSProperties}
      onClick={() => {
        if (!done) setIndex((i) => i + 1);
        else tally.skip();
      }}
    >
      <span className="champion-veil" aria-hidden="true" />
      <span className="champion-rays" aria-hidden="true" />
      <ChampionMotes count={done ? 26 : 16} />

      {entry && hero && (
        <div className="champion-beat" key={entry.rosterId}>
          <div className="champion-stage">
            <span className="champion-halo" aria-hidden="true" />
            <span className="champion-shock" aria-hidden="true" />
            <span className="champion-floor" aria-hidden="true" />
            <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="champion-figure" seed={entry.rosterId} />
            <span className="champion-flash" aria-hidden="true" />
            {beatStar && <BeatStar star={beatStar} />}
          </div>

          <div className="champion-plate">
            <div className="champion-kicker">Champion</div>
            <h2 className="champion-name">{hero.name}</h2>
            <div className="champion-rule" aria-hidden="true">
              <span />◆<span />
            </div>
            <div className="champion-facts">
              {form && <span className="champion-form">{form}</span>}
              <span className="champion-level">Level {levelOf(entry)}</span>
            </div>
            <div className="champion-types">
              {rosterEntryTypes(hero, entry).map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            {beatStar && (
              <div className={`champion-star-note star-cycle-${beatStar.cycle}`}>
                {beatStar.fromCycle > 0 ? `Star raised to Cycle ${CYCLE_NUMERALS[beatStar.cycle - 1]}` : 'New star'}
              </div>
            )}
          </div>
        </div>
      )}

      {!done && (
        <div className="champion-progress" aria-label={`Champion ${index + 1} of ${roster.length}`}>
          {roster.map((r, i) => (
            <span key={r.rosterId} className={`champion-pip${i < index ? ' is-past' : i === index ? ' is-here' : ''}`} />
          ))}
        </div>
      )}

      {done && (
        <div className="champion-hall" ref={tally.hallRef}>
          <div className="champion-hall-head">
            <div className="champion-kicker">Cycle {cycleOf(run.cycle).numeral} · The Titan is sealed</div>
            <h2 className="champion-title">Heroes of the Land</h2>
            <div className="champion-rule" aria-hidden="true">
              <span />◆<span />
            </div>
          </div>
          <div className="champion-row">
            {roster.map((r, i) => {
              const h = rosterHeroes[r.heroId];
              if (!h) return null;
              const earned = stars?.byRosterId[r.rosterId];
              const top = topStar(earned);
              const stepAt = tally.steps.findIndex((s) => s.kind === 'hero' && s.rosterId === r.rosterId);
              const lit = stepAt >= 0 && tally.reached >= stepAt;
              return (
                <div
                  key={r.rosterId}
                  className="champion-cell"
                  style={{ '--pact-rgb': getTypeColorRgb(h.types[0]), '--enter': `${0.25 + i * 0.12}s` } as CSSProperties}
                >
                  <span className="champion-cell-floor" aria-hidden="true" />
                  <HeroPortrait heroId={h.id} pathId={formIdFor(r)} className="champion-cell-figure" seed={r.rosterId} />
                  {top && (
                    <span
                      ref={(el) => {
                        if (el) tally.cellStarRefs.current.set(r.rosterId, el);
                        else tally.cellStarRefs.current.delete(r.rosterId);
                      }}
                      className={`champion-cell-star star-cycle-${lit || top.fromCycle === 0 ? top.cycle : top.fromCycle}${lit ? ' is-lit' : ''}`}
                      aria-hidden="true"
                    >
                      ★
                    </span>
                  )}
                  <div className="champion-cell-name">{h.name}</div>
                  <div className="champion-cell-level">Lv {levelOf(r)}</div>
                </div>
              );
            })}
          </div>

          {stars && tally.steps.length > 0 && (
            <div className={`champion-tally${tally.settled ? ' is-settled' : ''}`}>
              <div className="champion-tally-count" ref={tally.countRef} key={tally.shown}>
                <span className="champion-tally-glyph">★</span>
                <span className="champion-tally-number">{tally.shown}</span>
              </div>
              <div className="champion-tally-chips">
                {tally.steps.map((step, i) =>
                  step.kind === 'hero' || i > tally.reached ? null : (
                    <span key={step.kind} className="champion-tally-chip">
                      {step.kind === 'bonus' ? `Cycle ${cycleOf(run.cycle).numeral} cleared` : 'Companion'}
                      {step.add > 0 && <b> +{step.add}</b>}
                    </span>
                  ),
                )}
              </div>
              {tally.settled && <span className="champion-tally-burst" aria-hidden="true" />}
            </div>
          )}

          {tally.flyers.map((f) => (
            <span
              key={f.key}
              className={`champion-flyer star-cycle-${f.cycle}`}
              style={{ left: f.x, top: f.y, '--dx': `${f.dx}px`, '--dy': `${f.dy}px` } as CSSProperties}
              aria-hidden="true"
            >
              ★
            </span>
          ))}

          {tally.settled && (
            <>
              <p className="champion-line">Their names are kept where the seals are. The last two held; the world is still here.</p>
              <PlateButton
                className="champion-continue"
                onClick={(event) => {
                  event.stopPropagation();
                  onContinue();
                }}
              >
                Continue
              </PlateButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}
