import type { ReactNode } from 'react';
import type { TypeId } from '../../engine/content';
import { HeroPortrait } from './HeroPortrait';
import { TypeBadge } from './TypeBadge';
import { MasteryPips } from './MasteryPips';

interface Props {
  heroId: string;
  pathId?: string | null;
  name: string;
  level?: number;
  types: readonly TypeId[];
  mastery?: number;
  /** Evolution and Class badges, beside the types. */
  badges?: ReactNode;
  /** The stat columns, under the name. */
  stats: ReactNode;
}

/** The hero sheet's top: the hero large on the left, its name and its stat line beside it, read on every page. */
export function HeroSheetBanner({ heroId, pathId, name, level, types, mastery, badges, stats }: Props) {
  return (
    <div className="sheet-banner">
      <span className="sheet-banner-portrait">
        {level !== undefined && (
          <span className="sheet-banner-level">
            Lv <b>{level}</b>
          </span>
        )}
        <HeroPortrait heroId={heroId} pathId={pathId} className="sheet-banner-sprite" />
      </span>
      <div className="sheet-banner-titles">
        <div className="sheet-banner-name">{name}</div>
        <div className="sheet-banner-tags">
          {types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
          {badges}
        </div>
        {mastery !== undefined && <MasteryPips mastery={mastery} className="sheet-banner-mastery" />}
        {stats}
      </div>
    </div>
  );
}
