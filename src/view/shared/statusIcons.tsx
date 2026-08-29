import { useId, type ReactNode } from 'react';
import type { StatusDefinition } from '../../engine/content';
import { getTypeColor } from '../combat/typeColors';
import { ELEMENT_PATHS, FLAME } from './elementIcons';

/**
 * Elemental Force ids follow the `${Type}Force` naming convention
 * (src/data/statuses.ts) — stripping the suffix back to a bare TypeId lets
 * these chips reuse typeColors.ts's per-type color instead of hand-authoring
 * 15 near-duplicate entries into STATUS_COLOR below, and keeps a Force chip's
 * color in sync with its type's color everywhere else in the app.
 */
const FORCE_ID_SUFFIX = 'Force';

/** The bare TypeId a Force status id boosts, or undefined if `statusId` isn't a recognized Force status. */
function forceStatusType(statusId: string): string | undefined {
  if (!statusId.endsWith(FORCE_ID_SUFFIX)) return undefined;
  const base = statusId.slice(0, -FORCE_ID_SUFFIX.length);
  return ELEMENT_PATHS[base] ? base : undefined;
}

/**
 * The nine authored statuses, as inline vector art — the same 24x24 grid,
 * `currentColor`-only rule and "nothing finer than ~2 units" floor as every
 * other family in the vocabulary (statIcons.tsx, sectionIcons.tsx,
 * nodeIcons.tsx, elementIcons.tsx).
 *
 * These were 32px pixel-art PNGs pinned to exactly 16px, because 16 was the
 * only size below native that a 32px source can land on honestly
 * (docs/icon-pack.md "The size constraint"). Three things that bought:
 *
 * 1. **The badge is tinted and the icon was not.** A status chip sets its own
 *    `color` from `statusColor` below and the PNG ignored it, so the icon
 *    needed a drop-shadow to separate from the very chip it belonged to.
 *    These draw in `currentColor` — the glyph IS the status's color now, the
 *    same fix statIcons.tsx made for the stat bars.
 * 2. **The pack could not spell Elemental Force.** Four of the fifteen types
 *    (Iron, Mech, Beast, Ancient) have no element row in the sheet, so those
 *    Force chips fell back to an emoji and a hero holding two Forces at once
 *    rendered in two art styles. Force is now composed here — an element from
 *    elementIcons.tsx under a drawn up-arrow — so all fifteen are one set.
 * 3. **16px was the floor, and the bench row wanted less.** The switch
 *    picker's cards are half-size and the emoji shrank to 8px there while the
 *    icon could not follow (8 would have been a quarter-scale resample). A
 *    path has no dishonest size, so the bench badges scale like everything
 *    else on those cards.
 *
 * Two shapes are borrowed rather than drawn, both because the pairing is
 * literal rather than decorative — the same trade MoveKindBadge and the map
 * nodes make:
 *
 * - **Burn is elementIcons.tsx's FLAME**, the very glyph Fire Force wears.
 *   The emoji set went out of its way to avoid this (Fire Force was a volcano
 *   precisely because Burn had claimed the flame) and the dodge cost more than
 *   it saved. With the up-arrow modifier drawn on, a flame can mean fire in
 *   both places and the arrow says which one is the buff.
 * - **Renew is statIcons.tsx's HP heart with a rising chevron knocked out of
 *   it** — exactly the grammar that separates MP Regen from Mana Pool over
 *   there ("the modifier names the family, the base shape names the member").
 *   Renew heals HP every round; it is the heart, ticking.
 */
const STATUS_PATHS: Record<string, ReactNode> = {
  /** The Fire element's flame — see the note above. */
  Burn: FLAME,
  /** A gash with two drops falling from it. Neither half works alone: a drop by itself is Mana Pool's glyph, and a gash by itself is the map's monster claw. Together they are the only thing they can be. */
  Bleed: (
    <>
      <path d="M2.8 2.2c6.2 1.8 11.2 5.6 14.9 11.2-5.6-2.4-10.6-6.2-14.9-11.2Z" />
      <path d="M8 14c1.9 2.4 2.9 3.9 2.9 5.1a2.9 2.9 0 0 1-5.8 0c0-1.2 1-2.7 2.9-5.1Z" />
      <path d="M16.6 16.6c1.6 2 2.4 3.2 2.4 4.2a2.4 2.4 0 0 1-4.8 0c0-1 .8-2.2 2.4-4.2Z" />
    </>
  ),
  /** A six-spoke snowflake, drawn as three crossing bars and nothing else. The barbs a real snowflake wants are ~1 unit of line work and would be the first thing to die; radial symmetry is what has to survive, because that is what separates this from the Frost element's angular shards. */
  Freeze: (
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M12 2.4v19.2" />
      <path d="M3.7 7.2 20.3 16.8" />
      <path d="M3.7 16.8 20.3 7.2" />
    </g>
  ),
  /**
   * A swirl. Deliberately not stars-around-the-head, the other stock "dazed"
   * picture: the four-point star is the Intelligence stat and the five-point
   * one is the Passives header, and a Dazed hero's card shows both.
   *
   * One and a quarter turns, and that is a hard ceiling rather than a taste
   * call. A 3-unit stroke needs ~5 units of radius between consecutive turns
   * to keep a gap, and the box only has 9 units of radius to spend — so a
   * "proper" spiral of two or three turns closes into a solid disc at badge
   * size. The first attempt here had exactly that problem and read as a
   * lowercase e.
   */
  Daze: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      d="M2.8 12A6.9 6.9 0 0 1 16.6 12A2.9 2.9 0 0 1 10.8 12"
    />
  ),
  /** The HP heart with a rising chevron knocked out of it — see the note above. The heart's `d` is copied out of statIcons.tsx rather than imported: STAT_PATHS.hp is a finished <path> element and this needs the raw geometry, because the chevron is subtracted from the heart (evenodd) rather than laid on top of it. Redraw one, redraw the other. */
  Renew: (
    <path
      fillRule="evenodd"
      d="M12 21.6 3.7 13.1a5.3 5.3 0 0 1 7.5-7.5l.8.8.8-.8a5.3 5.3 0 0 1 7.5 7.5ZM12 9.6 7.4 14.2l1.8 1.8L12 13.2l2.8 2.8 1.8-1.8Z"
    />
  ),
  /** A bare bolt. The Storm element deliberately carries a cloud as well (elementIcons.tsx) so that this one can stay bare — the two are on the field together whenever a Storm hero plants the mark. */
  Conduct: <path d="M13.8 1.8 5.6 13.4h4.8L8.8 22.6 18.4 10.2h-5.2Z" />,
  /** A trefoil. The two stock poison pictures are both taken — the skull is the Guardian boss (nodeIcons.tsx) and the flask is the Statuses section header (sectionIcons.tsx) — and a trefoil says "hazard" without either, in three lobes fat enough to survive the badge. */
  Poison: (
    <>
      <circle cx="12" cy="6.2" r="4.6" />
      <circle cx="6.4" cy="15.8" r="4.6" />
      <circle cx="17.6" cy="15.8" r="4.6" />
      <circle cx="12" cy="12.8" r="3.4" />
    </>
  ),
  /** A ghost, and the only glyph in the status set with a face. That is the point: Haunt is the one status that follows a hero to their partner, and nodeIcons.tsx already established that eyes are what make a shape read as something looking back at you. The Spirit element is drawn faceless for exactly this reason. */
  Haunt: (
    <path
      fillRule="evenodd"
      d="M12 1.8c4.5 0 7.9 3.4 7.9 8v11c0 1.1-1.2 1.7-2 1l-2-1.8-2.1 1.9a1.3 1.3 0 0 1-1.7 0L10 20l-2 1.8c-.8.7-2 .1-2-1v-11c0-4.6 3.5-8 8-8ZM9.2 9.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm5.6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
    />
  ),
  /** A closed eye — a lid, its lashes, and nothing behind it. An open eye with a slash through it is the other way to say "cannot be seen", and it needs the slash to cut a clean gap through the eye to read at all; a lid says the same thing in one arc. */
  Stealth: (
    <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
      <path d="M2.6 9.6c2.6 3.6 5.8 5.4 9.4 5.4s6.8-1.8 9.4-5.4" />
      <path d="M3.6 16.6 5.8 13.4" />
      <path d="M8.6 19.2 9.8 15.4" />
      <path d="M15.4 19.2 14.2 15.4" />
      <path d="M20.4 16.6 18.2 13.4" />
    </g>
  ),
};

/**
 * The up-arrow every Elemental Force chip carries, in the bottom-right corner.
 * It is what makes the family legible as a family: fifteen chips that differ
 * only by element would each have to be recognised on its own, where fifteen
 * chips that all wear the same arrow are recognised as "a Force" first and
 * identified second. It is also a literal picture of what the status does —
 * flat Base Power added to that type's moves.
 */
const FORCE_ARROW = <path d="M18.2 13.4 23.4 20h-3.2v3.4h-4V20H13Z" />;

/**
 * How the two halves are kept apart, and the one place in the whole vector
 * vocabulary that needs a mask.
 *
 * nodeIcons.tsx's crowned Elite helm solves the same problem by geometry — the
 * crown floats clear of the dome — and that only works because there is one
 * dome, drawn to suit. Here the arrow sits over fifteen different elements,
 * four of which (the Light sun's rays, the Arcane orbit, the Mech cog, the
 * Beast paw) reach into the bottom-right corner no matter how far the element
 * is scaled back. So the corner is cut out of the element instead: a disc of
 * empty space, punched by a mask, that the arrow then sits inside. Every
 * element gets the same clearance whatever its silhouette, and because it is a
 * hole rather than a second colour it works on a chip whose element and status
 * colours are identical.
 */
const FORCE_ELEMENT_TRANSFORM = 'translate(-1.3 -1.7) scale(0.8)';

/**
 * The one place a status's glyph is drawn. Every surface that shows a status —
 * the battlefield shoulder badge, StatusDetailOverlay, HeroDetailOverlay's
 * chip, ReferenceOverlay's catalog — renders this rather than interpolating a
 * string, so the icon decision is made once.
 *
 * Falls back to the id's first letter for a status with no authored path. That
 * is now a genuinely dead path for shipped content (all nine statuses and all
 * fifteen Forces are drawn), and it is kept for the same reason
 * passiveIcons.tsx renders passives without an icon: new content should be
 * playable before it is drawn.
 *
 * `alt`/`aria-hidden` because the badge or chip that wraps this already carries
 * the status name in its `title`, and a duplicate accessible name on the icon
 * would make a screen reader say it twice.
 */
export function StatusGlyph({ statusId, className }: { statusId: string; className?: string }) {
  // React's generated ids contain colons, which are legal in an HTML id but
  // are a selector metacharacter — `url(#:r7:)` does not resolve everywhere.
  const maskId = `force-cut-${useId().replace(/:/g, '')}`;
  const forceType = forceStatusType(statusId);
  const path = forceType ? (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect x="0" y="0" width="24" height="24" fill="#fff" />
        <circle cx="18.9" cy="19.1" r="6" fill="#000" />
      </mask>
      <g mask={`url(#${maskId})`} transform={FORCE_ELEMENT_TRANSFORM}>
        {ELEMENT_PATHS[forceType]}
      </g>
      {FORCE_ARROW}
    </>
  ) : (
    STATUS_PATHS[statusId]
  );
  const cls = className ? ` ${className}` : '';
  if (!path) return <span className={`status-emoji${cls}`}>{statusId.slice(0, 1)}</span>;
  return (
    <svg className={`status-glyph${cls}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {path}
    </svg>
  );
}

/**
 * Identity color per status — Fire-orange Burn, Frost-cyan Freeze, and so on
 * (Renew/Conduct reuse the app's existing --hp-high/--conduct tokens) — so a
 * badge reads as "which status" by color alone, not just by its shape.
 * Applied via inline style (mirrors TypeBadge/getTypeColor, since 9 statuses
 * is a JS lookup, not something worth 9 enumerated CSS classes) everywhere a
 * status chip renders: CombatantCard's badge, StatusDetailOverlay, and
 * HeroDetailOverlay's chip.
 */
const STATUS_COLOR: Record<string, string> = {
  Burn: '#e2683c',
  Bleed: '#c0392b',
  Freeze: '#7fd6e0',
  Daze: '#c9a0f5',
  Renew: '#4caf6a',
  Conduct: '#f5d90a',
  Poison: '#8bc34a',
  Haunt: '#7a5fc4',
  Stealth: '#6b7a99',
};

export function statusColor(statusId: string): string {
  const forceType = forceStatusType(statusId);
  if (forceType) return getTypeColor(forceType);
  return STATUS_COLOR[statusId] ?? '#d9a441';
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `rgba(...)` tint of a status's color, for chip backgrounds/borders — same soft-tinted-chip look styles.css already uses for --accent/--enemy (e.g. .switching-tag), just computed since these colors are per-status data rather than fixed custom properties. */
export function statusTint(statusId: string, alpha: number): string {
  const [r, g, b] = hexToRgb(statusColor(statusId));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Poison's timer is a fixed 3-round countdown to detonation (statusEngine.ts
 * tickEndOfRound: duration goes 3 -> 2 -> 1 -> detonate, never resetting on
 * reapplication — docs/conditions.md §7 Q3/Q4). A single emoji can't show
 * that progress, so PoisonPips below renders 3 small pips and fills one
 * more as detonation nears: freshly applied (duration 3) is 1 filled pip,
 * the final round before it pops (duration 1) is all 3.
 */
export function poisonTier(duration: number | undefined): 1 | 2 | 3 {
  if (duration === undefined || duration >= 3) return 1;
  if (duration === 2) return 2;
  return 3;
}

/** Human-readable label per pipeline value — shared by StatusDetailOverlay's live readout and ReferenceOverlay's static catalog, so the two never drift. */
const PIPELINE_LABELS: Record<StatusDefinition['pipeline'], string> = {
  dot: 'Damage over time',
  hot: 'Heal over time',
  control: 'Control effect',
  timer: 'Delayed detonation',
  trigger: 'Trigger / mark',
  target: 'Targeting effect',
  basePower: 'Elemental Force',
  none: 'Effect',
};

export function pipelineLabel(pipeline: StatusDefinition['pipeline']): string {
  return PIPELINE_LABELS[pipeline];
}

/** How a status is removed, in prose — same clearsOnSwitch/positive branching StatusDetailOverlay used inline, lifted here so ReferenceOverlay's catalog entries read identically. */
export function statusClearText(def: StatusDefinition): string {
  if (def.clearsOnSwitch) return 'Cleared by switching to the bench.';
  return def.positive ? "Persists through switching — Cleanse can't remove it." : 'Persists through switching — removed by Cleanse.';
}

/** The 3-pip "how close to detonation" meter — sits next to Poison's emoji+magnitude in both CombatantCard and StatusDetailOverlay. Pip color is set here (Poison's own color, via currentColor) so callers don't each have to know it. */
export function PoisonPips({ duration }: { duration: number | undefined }) {
  const tier = poisonTier(duration);
  return (
    <span className="status-pips" style={{ color: statusColor('Poison') }} aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span key={i} className={`status-pip${i <= tier ? ' status-pip-filled' : ''}`} />
      ))}
    </span>
  );
}
