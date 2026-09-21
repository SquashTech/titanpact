import type { CSSProperties } from 'react';
import type { StatKey } from '../../engine/content';
import { relicColor } from '../shared/relicIcons';
import { STAT_FULL_LABELS, type StackableGrant } from '../shared/relicStacks';
import { STAT_COLORS, StatGlyph } from '../shared/statIcons';

interface Props {
  /** The Banner being read. Null reserves the height and shows nothing. */
  relic: (StackableGrant & { id: string }) | null;
  /** Copies the numerals are summed over: one for an offer, the run's count once it is raised. */
  copies: number;
  /** A line under the cells when there is one to say — what raising this over the held ones comes to. */
  note?: string;
}

/**
 * A Banner's grant, written large: one cell a stat, the numeral in the stat's own colour over the
 * glyph the cloth carries. It used to be a line of the header's readout, eleven pixels of prose
 * in the top corner of a screen whose middle is three standards — the one number the screen
 * exists to ask about was the smallest thing on it.
 */
export function BannerGrantPlaque({ relic, copies, note }: Props) {
  if (!relic) return <div className="banner-grant-plaque is-empty" aria-hidden="true" />;
  const grants = (Object.entries(relic.statGrants) as [StatKey, number][]).filter(([, amount]) => amount);
  return (
    <div className="banner-grant-plaque" key={relic.id} style={{ '--relic-color': relicColor(relic.id) } as CSSProperties}>
      <div className="banner-grant-scope">Team-wide</div>
      <div className="banner-grant-cells">
        {grants.map(([stat, amount], i) => {
          const total = amount * copies;
          return (
            <div className="banner-grant-cell" key={stat} style={{ animationDelay: `${i * 70}ms` }}>
              <span className="banner-grant-amount" style={{ color: STAT_COLORS[stat] }}>
                {total >= 0 ? `+${total}` : total}
              </span>
              <span className="banner-grant-stat">
                <StatGlyph stat={stat} />
                {STAT_FULL_LABELS[stat]}
              </span>
            </div>
          );
        })}
      </div>
      {note && <div className="banner-grant-note">{note}</div>}
    </div>
  );
}
