// The XP bar's choreography, shared by the fight result and the level-up report: one grant, cut
// into the sweeps it makes across a bar that starts wherever the hero's XP already stood. A
// hero part-way to a level tops out sooner than one on the line; a hero behind par sweeps more
// bars on the same XP; a grant that lands no level still moves the bar — which is the whole
// reason XP is a visible number and not a level count (run/growth.ts ENCOUNTER_XP_BY_ACT).

import { MAX_LEVEL, MAX_XP, levelForXp, xpProgress } from '../../run/growth';

/** One sweep of the bar, in fractions of its width. */
export interface XpBarSegment {
  from: number;
  to: number;
  /** The sweep tops the bar out — a level. */
  tick: boolean;
  ms: number;
}

/** A full bar, edge to edge. Roster-wide, so every bar runs the same clock per level. */
export const XP_FILL_MS = 460;
/** A sliver still has to be seen moving. */
export const XP_FILL_MIN_MS = 120;

/** The sweeps `fromXp → toXp` makes. Empty for a hero at the cap, or a grant of nothing. */
export function xpBarSegments(fromXp: number, toXp: number): XpBarSegment[] {
  const end = Math.min(MAX_XP, toXp);
  const fromLevel = levelForXp(fromXp);
  const toLevel = levelForXp(end);
  if (fromLevel >= MAX_LEVEL || end <= fromXp) return [];
  const segments: XpBarSegment[] = [];
  let cursor = xpProgress(fromXp);
  for (let level = fromLevel; level < toLevel; level++) {
    segments.push(segment(cursor, 1, true));
    cursor = 0;
  }
  // The rest, part-way into the level the grant ended in. Nothing past a bar that just topped out
  // at the cap, and nothing for a grant that landed exactly on a level.
  const rest = toLevel >= MAX_LEVEL ? 0 : xpProgress(end);
  if (rest > cursor) segments.push(segment(cursor, rest, false));
  return segments;
}

function segment(from: number, to: number, tick: boolean): XpBarSegment {
  return { from, to, tick, ms: Math.max(XP_FILL_MIN_MS, Math.round(XP_FILL_MS * (to - from))) };
}

/** How long the whole grant takes to sweep. */
export function xpBarTotalMs(segments: readonly XpBarSegment[]): number {
  return segments.reduce((total, s) => total + s.ms, 0);
}

/** When, from the first sweep starting, each level lands. */
export function xpBarTickTimes(segments: readonly XpBarSegment[]): number[] {
  const ticks: number[] = [];
  let at = 0;
  for (const s of segments) {
    at += s.ms;
    if (s.tick) ticks.push(at);
  }
  return ticks;
}

/**
 * Runs `segments` on the bar's fill element, one after another, calling `onTick` as each level
 * lands. Web Animations rather than a CSS keyframe iterated per level: the sweeps are no longer
 * all the same length, and a per-segment `animate` keeps the badge's tick on the exact frame the
 * bar tops out without a timer per hero per level. Returns the cancel.
 */
export function playXpBar(
  fill: HTMLElement,
  segments: readonly XpBarSegment[],
  delayMs: number,
  onTick: (levelsLanded: number) => void,
  onDone?: () => void
): () => void {
  let cancelled = false;
  let current: Animation | null = null;
  const run = async () => {
    if (delayMs > 0) await wait(delayMs);
    let landed = 0;
    for (const s of segments) {
      if (cancelled) return;
      current = fill.animate([{ width: `${s.from * 100}%` }, { width: `${s.to * 100}%` }], {
        duration: s.ms,
        easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
        fill: 'forwards',
      });
      try {
        await current.finished;
      } catch {
        return;
      }
      if (cancelled) return;
      if (s.tick) onTick(++landed);
    }
    onDone?.();
  };
  void run();
  return () => {
    cancelled = true;
    current?.cancel();
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
