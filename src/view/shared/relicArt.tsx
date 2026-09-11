import { type CSSProperties } from 'react';
import { STAT_ORDER } from '../../engine/content';
import { StatGlyph } from './statIcons';
import { grantsFor, relicColor } from './relicIcons';

// The relic drawn as an OBJECT rather than as the 24x24 currentColor mark in relicIcons.tsx
// (2026-09-08, per user direction). A relic offer used to be rectangles of prose; the axis is
// flat stats, so the words were the only thing carrying it and they carried it badly. This is
// the form cut properly — a hanging standard that sways — with the stat's own glyph as the
// charge, which is the whole of what a player has to read to make the pick.
//
// The small marks are NOT replaced: a chip inside a sentence still wants the flat glyph. This is
// for the surfaces where the relic IS the subject (the choice screens, the run's relic rails).

/** The colour a relic is cut in — its lead stat's, so an Emerald is HP-green and a Ruby Attack-red. */
function relicStyle(relicId: string): CSSProperties {
  return { '--relic-color': relicColor(relicId) } as CSSProperties;
}

/**
 * The charge a relic carries: a glyph per stat it grants, in STAT_ORDER. Every stat rather than
 * just the lead one, because the two-stat Banners (the Warcry, the Bulwark) are exactly the pair
 * a single glyph could not tell apart — and the glyphs are the only thing these screens print.
 */
function RelicCharge({ relicId, className }: { relicId: string; className?: string }) {
  const grants = grantsFor(relicId);
  const stats = STAT_ORDER.filter((stat) => !!grants[stat]);
  if (stats.length === 0) return null;
  // The two-stat Banners (Warcry, Bulwark) carry twice the width in the same cloth, which is 62%
  // of the art's box — so a pair set at the single glyph's size hangs off both folds. It always
  // did; growing the banners for the stage is what made it visible.
  return (
    <span className={`${className ?? ''}${stats.length > 1 ? ' is-pair' : ''}`}>
      {stats.map((stat) => (
        <StatGlyph key={stat} stat={stat} tone="inherit" />
      ))}
    </span>
  );
}

/**
 * A standard on its crossbar: swallowtail field, a charge, and a slow sway from the bar it hangs
 * on. The sheen runs down the cloth rather than across it — a banner is lit from above.
 */
export function BannerStandard({ relicId, className }: { relicId: string; className?: string }) {
  return (
    <span className={`banner-standard${className ? ` ${className}` : ''}`} style={relicStyle(relicId)} aria-hidden="true">
      <svg className="banner-standard-cloth" viewBox="0 0 64 80" focusable="false">
        <g className="banner-sway">
          <path className="banner-field" d="M12 10h40v46l-8 8-6-7-6 7-6-7-8 8Z" />
          {/* One fold down each side of the charge: flat cloth reads as a paper cutout. */}
          <path className="banner-fold is-left" d="M12 10h9v52l-9 9Z" />
          <path className="banner-fold is-right" d="M52 10h-9v52l9 9Z" />
          <rect className="banner-sheen" x="14" y="10" width="10" height="62" />
        </g>
        {/* The bar is fixed — the cloth swings under it, which is what sells the hang. */}
        <rect className="banner-bar" x="6" y="4" width="52" height="7" rx="3.5" />
        <circle className="banner-finial" cx="6" cy="7.5" r="4" />
        <circle className="banner-finial" cx="58" cy="7.5" r="4" />
      </svg>

      <RelicCharge relicId={relicId} className="banner-standard-charge" />
    </span>
  );
}

/** Whichever form the relic's family calls for — the one place a caller need not know which it is. */
export function RelicArt({ relicId, className }: { relicId: string; className?: string }) {
  return <BannerStandard relicId={relicId} className={className} />;
}
