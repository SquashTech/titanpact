import { useId, type CSSProperties } from 'react';
import { STAT_ORDER } from '../../engine/content';
import { relics } from '../../data/relics';
import { StatGlyph } from './statIcons';
import { relicColor } from './relicIcons';

// The two relic families drawn as OBJECTS rather than as the 24x24 currentColor marks in
// relicIcons.tsx (2026-09-08, per user direction). A Gem offer used to be three rectangles of
// prose; the relic axis is flat stats, so the words were the only thing carrying it and they
// carried it badly. These are the same two forms cut properly — a faceted brilliant that catches
// a moving light, a hanging standard that sways — with the stat's own glyph as the charge, which
// is the whole of what a player has to read to make the pick.
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
  const grants = relics[relicId]?.statGrants ?? {};
  const stats = STAT_ORDER.filter((stat) => !!grants[stat]);
  if (stats.length === 0) return null;
  return (
    <span className={className}>
      {stats.map((stat) => (
        <StatGlyph key={stat} stat={stat} tone="inherit" />
      ))}
    </span>
  );
}

/**
 * A brilliant cut: table and two crown facets over three pavilion facets meeting at the culet.
 * Six planes is the fewest that still reads as CUT rather than as a coloured pentagon — each one
 * takes its own mix of the stat colour toward white or toward black, so the stone has a lit side.
 *
 * The glisten is a bar of light swept across the whole stone on a loop, clipped to the silhouette.
 * `useId` because two gems on one screen would otherwise share a clip path.
 */
export function GemJewel({ relicId, className }: { relicId: string; className?: string }) {
  const clipId = `gem-clip-${useId().replace(/:/g, '')}`;

  return (
    <span className={`gem-jewel${className ? ` ${className}` : ''}`} style={relicStyle(relicId)} aria-hidden="true">
      <svg className="gem-jewel-cut" viewBox="0 0 64 64" focusable="false">
        <defs>
          <clipPath id={clipId}>
            <path d="M18 8h28l14 18-28 34L4 26Z" />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {/* Crown — the lit half. */}
          <path className="gem-facet is-table" d="M18 8h28l-5 18H23Z" />
          <path className="gem-facet is-crown-left" d="M18 8 23 26H4Z" />
          <path className="gem-facet is-crown-right" d="M46 8 60 26H41Z" />
          {/* Pavilion — falls away from the light, so it carries the depth. */}
          <path className="gem-facet is-pavilion-left" d="M4 26h19L32 60Z" />
          <path className="gem-facet is-pavilion-mid" d="M23 26h18L32 60Z" />
          <path className="gem-facet is-pavilion-right" d="M41 26h19L32 60Z" />
          {/* Girdle: the one hard line in the stone, where crown meets pavilion. */}
          <path className="gem-girdle" d="M4 26h56" />
          <rect className="gem-glisten" x="-46" y="-10" width="26" height="84" transform="skewX(-18)" />
        </g>

        <path className="gem-outline" d="M18 8h28l14 18-28 34L4 26Z" />
      </svg>

      {/* Four-point stars on the stone's corners, each on its own beat. */}
      <span className="gem-sparkle is-a" />
      <span className="gem-sparkle is-b" />
      <span className="gem-sparkle is-c" />

      <RelicCharge relicId={relicId} className="gem-jewel-charge" />
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
  return relics[relicId]?.gem ? (
    <GemJewel relicId={relicId} className={className} />
  ) : (
    <BannerStandard relicId={relicId} className={className} />
  );
}
