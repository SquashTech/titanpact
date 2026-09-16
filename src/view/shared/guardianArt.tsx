// The Guardians' figures as a component (guardianFigures.ts draws them): the same shape as
// TitanspawnGlyph, and HeroPortrait dispatches to it by id, so every screen that shows a hero
// shows a Guardian with no other change. Markup is built as a string and mounted with
// innerHTML: nothing in it comes from outside the figure module.

import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { GUARDIAN_VIEW_BOX, guardianMarkup, type GuardianPose } from './guardianFigures';

let nextUid = 0;

interface Props {
  heroId: string;
  className: string;
  pose?: GuardianPose;
  /** HeroPortrait's idle-breath variables; the figure breathes exactly as a sprite does. */
  style?: CSSProperties;
}

/**
 * A Guardian's figure, sized by the same class a hero's <img> takes and standing on the same
 * ground (the spawn's viewBox). It is drawn past the box on purpose — `overflow: visible` is what
 * lets it break the frame. Renders nothing for an id that is not a Guardian.
 */
export function GuardianGlyph({ heroId, className, pose = 'idle', style }: Props) {
  const uid = useMemo(() => `gd${(nextUid++).toString(36)}`, []);
  const markup = guardianMarkup(heroId, pose, uid);
  if (!markup) return null;
  return (
    <svg
      className={className}
      viewBox={GUARDIAN_VIEW_BOX}
      preserveAspectRatio="xMidYMax meet"
      style={{ overflow: 'visible', ...style }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
