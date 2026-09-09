import type { CSSProperties, ReactNode } from 'react';
import type { StatKey } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
import { relics } from '../../data/relics';
import { STAT_COLORS } from './statIcons';

// A relic drawn the way every other content type is: 24x24, `currentColor` only, nothing finer
// than ~2 units. Two halves — the FORM says which family it belongs to, the COLOUR says what it
// grants. The catalog is two closed families now (Gems and Banners, src/data/relics.ts), so the
// form comes straight off the definition's own flag; it used to be resolved from the relic's
// name, which was the machinery a wide random catalog needed and this one does not.

/**
 * The Gem: one unbroken brilliant — flat table, girdle at the shoulders, a point — with the table
 * facet knocked OUT of the crown. Exported because the map node wears it too (nodeIcons).
 */
export const GEM = <path fillRule="evenodd" d="M7.4 2.6h9.2l5 6.4L12 21.8 2.4 9ZM8.8 5h6.4l2.4 3H6.4Z" />;

/** The Banner: crossbar over a swallowtail field. No pole — at 14px the pole and field merge into a lolly. */
export const BANNER = (
  <>
    <rect x="2.8" y="1.8" width="18.4" height="2.6" rx="1.2" />
    <path d="M5.4 5.2h13.2v16.2L12 15.4 5.4 21.4Z" />
  </>
);

type RelicFormName = 'gem' | 'banner';

const RELIC_FORM_PATHS: Record<RelicFormName, ReactNode> = { gem: GEM, banner: BANNER };

/** The stat a relic leads with — highest grant, ties broken by STAT_ORDER. */
function dominantStat(grants: Partial<Record<StatKey, number>>): StatKey | undefined {
  let best: StatKey | undefined;
  for (const stat of STAT_ORDER) {
    if (!grants[stat]) continue;
    if (best === undefined || grants[stat]! > grants[best]!) best = stat;
  }
  return best;
}

/** The stat a relic reads as — its own lead grant. Undefined only for a relic that grants no stats. */
export function relicLeadStat(relicId: string): StatKey | undefined {
  return dominantStat(relics[relicId]?.statGrants ?? {});
}

const FALLBACK_COLOR = '#8b7fe0';

/** What the relic DOES, in one colour: its lead stat's. */
export function relicColor(relicId: string): string {
  const stat = dominantStat(relics[relicId]?.statGrants ?? {});
  return stat ? STAT_COLORS[stat] : FALLBACK_COLOR;
}

/**
 * The header mark for a screen that OFFERS relics, as opposed to one particular relic. Wears
 * `.section-glyph` because it sits in the same NodeHeader slot as the Equipment Cache's, and the
 * two headers should be the same size.
 */
export function RelicKindGlyph({ form }: { form: RelicFormName }) {
  return (
    <svg className="section-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {RELIC_FORM_PATHS[form]}
    </svg>
  );
}

/** The one place a relic is drawn. `aria-hidden`: every caller states the name in text beside it. */
export function RelicGlyph({ relicId, className }: { relicId: string; className?: string }) {
  return (
    <svg
      className={`relic-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={{ color: relicColor(relicId) } as CSSProperties}
    >
      {RELIC_FORM_PATHS[relics[relicId]?.gem ? 'gem' : 'banner']}
    </svg>
  );
}
