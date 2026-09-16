import type { CSSProperties } from 'react';
import { moves } from '../../data/moves';
import type { HeroDefinition } from '../../engine/content';
import { pathLeadType, pathTypes, type EvolutionPath } from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';

/** The neutral tint for a path that changes no type and grants no typed move: bone, a hue no type wears (gold sat beside Light, Stone and Beast). */
const NEUTRAL_LEAD = '#d9cfb6';

/**
 * The two colours a path is washed in wherever it is drawn — the Evolution choice, the dossier
 * card, the Compendium's star cell — so the same path looks the same on every screen. `lead` is
 * what the path is ABOUT (run/progression.ts pathLeadType: the graft or the granted move's type,
 * or neutral bone), and `trail` the half of the resulting typing that comes along.
 */
export function pathTint(hero: HeroDefinition, path: EvolutionPath): { lead: string; trail: string } {
  const types = pathTypes(hero, path);
  const leadType = pathLeadType(hero, path, moves);
  const trailType = types.find((t) => t !== leadType) ?? types[0];
  return { lead: leadType ? getTypeColor(leadType) : NEUTRAL_LEAD, trail: getTypeColor(trailType) };
}

/** `--path-lead` / `--path-trail`, for a card that paints itself off them. */
export function pathTintStyle(hero: HeroDefinition, path: EvolutionPath): CSSProperties {
  const { lead, trail } = pathTint(hero, path);
  return { '--path-lead': lead, '--path-trail': trail } as CSSProperties;
}
