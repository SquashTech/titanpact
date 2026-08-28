import { useMemo, type CSSProperties, type ReactNode } from 'react';

/**
 * The shared stage every map-node screen is set on — the full-bleed sky and
 * the unboxed header LevelUpScreen introduced in the fourth pass of
 * docs/visual-language.md, lifted out of that screen so the rest of the run
 * loop can stand on the same ground.
 *
 * The node screens were the last place in the app where a *bordered banner
 * carrying no action* introduced a grid of buttons — `.equip-cache-banner`,
 * `.relic-shrine-banner`, `.class-shrine-banner`, `.equip-spotlight` and the
 * plain `.reward-panel` were five variations on the same box. This module is
 * what replaced them: a place (the sky), a voice (the header), and nothing
 * drawn around either.
 *
 * Everything here is tinted from one custom property, `--node-rgb`, so a node
 * keeps the hue it already had — gold for a cache, violet for the Relic
 * Shrine, teal for the Mentor, the item's own rarity colour for a forced
 * equip — without the stylesheet naming any of them.
 *
 * **The screen sets that property once, on its own root** (`style={{
 * '--node-rgb': NODE_TINT_ARCANE }}` on the `.node-screen` div), and the sky,
 * the header and anything else the screen draws inherit it. Neither component
 * takes a tint of its own: when they did, a sibling of the header — the gold
 * cache's amount, say — silently fell back to the default while the header
 * beside it was green.
 */

/** Gold, the run loop's default reward hue (var(--accent) as an rgb triple). */
export const NODE_TINT_GOLD = '224, 166, 60';
/** var(--magical) — relics and pacts. */
export const NODE_TINT_ARCANE = '139, 127, 224';
/** var(--buff) — the Mentor's teal. */
export const NODE_TINT_TEAL = '63, 184, 175';
/** var(--hp-high) — vitality grants. */
export const NODE_TINT_VITAL = '76, 175, 106';
/** var(--mana) — mana pool and regen grants. */
export const NODE_TINT_MANA = '74, 144, 217';

const MOTE_COUNT = 12;

/**
 * Ambient motes drifting up the screen — the same golden-angle scatter the
 * draft, the title and the level-up screen use (a pure function of the index,
 * so it is stable across re-renders with no seed to store).
 */
function useMotes(count: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seed = i * 137.51;
        return {
          left: seed % 100,
          delay: (seed * 1.3) % 7,
          duration: 6 + ((seed * 0.29) % 4),
          size: 2 + ((seed * 0.17) % 2),
        };
      }),
    [count]
  );
}

interface NodeSkyProps {
  /** Fewer motes for a screen with a lot of figures on it; more for one holding a single object. */
  motes?: number;
}

/**
 * Full-bleed past .app-shell's padding, same negative-inset trick as
 * .battlefield and .draft-sky: a place, not a container. Must be the first
 * child of a `position: relative` screen root, and everything after it needs
 * `position: relative; z-index: 1` (the `.node-screen > *` rule does this) —
 * the sky paints at z-index 0 and its wash bottoms out opaque, so a static
 * in-flow sibling would paint *under* it and vanish.
 */
export function NodeSky({ motes = MOTE_COUNT }: NodeSkyProps) {
  const field = useMotes(motes);
  return (
    <div className="node-sky" aria-hidden="true">
      <span className="node-sky-wash" />
      <div className="node-motes">
        {field.map((m, i) => (
          <span
            key={i}
            className="node-mote"
            style={
              {
                left: `${m.left}%`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.duration}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

interface NodeHeaderProps {
  /** Small letterspaced kicker above the title — what *kind* of moment this is ("Spoils", "A Pact Awaits"). */
  eyebrow?: string;
  /** The node's name. A string, not a node: it is duplicated blurred behind itself to make the bloom. */
  title: string;
  /** Drawn inline before the title (a RunGlyph, a ResourceMark). Deliberately not part of the bloom — a blurred icon reads as a smudge. */
  glyph?: ReactNode;
  /** The line under the title: what the player is being asked to do, or what just happened. Height is reserved either way so nothing below shifts. */
  readout?: ReactNode;
  /** True once `readout` is reporting an outcome rather than an instruction — brightens it, same as the level-up screen's feedback line. */
  readoutLive?: boolean;
  /** Remounts the readout (and so replays its fade) when it changes, rather than swapping the text in place. Keying the whole header instead would replay the title's arrival on every update. */
  readoutKey?: string;
  /** Art standing above the eyebrow (the Mentor). */
  art?: ReactNode;
  /** A slowly rotating dashed ring framing the header's art — ambient magic, the one piece of the shrine banners worth keeping. Ignored without art: around a bare title it reads as a stray circle drawn through the line of text under it, not as light. */
  ring?: boolean;
  /** Smaller type for a screen whose body is already tall (the Mentor's three discipline cards). */
  compact?: boolean;
  children?: ReactNode;
}

export function NodeHeader({
  eyebrow,
  title,
  glyph,
  readout,
  readoutKey,
  readoutLive,
  art,
  ring,
  compact,
  children,
}: NodeHeaderProps) {
  return (
    <header className={`node-header${compact ? ' is-compact' : ''}${art ? ' has-art' : ''}`}>
      {ring && art && <span className="node-ring" aria-hidden="true" />}
      {art}
      {eyebrow && <div className="node-eyebrow">{eyebrow}</div>}
      <h2 className="node-title">
        <span className="node-title-glow" aria-hidden="true">
          {title}
        </span>
        {glyph && <span className="node-title-glyph">{glyph}</span>}
        {title}
      </h2>
      {/* Between the title and the readout: whatever this node counts out
          before it says anything (the level-up screen's orb track). */}
      {children}
      {readout !== undefined && (
        <p className={`node-readout${readoutLive ? ' is-live' : ''}`} key={readoutKey}>
          {readout}
        </p>
      )}
    </header>
  );
}
