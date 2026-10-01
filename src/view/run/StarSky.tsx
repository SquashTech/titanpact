import type { CSSProperties, ReactNode } from 'react';
import { heroes } from '../../data/heroes';
import type { TypeId } from '../../engine/content';
import { ownsHero } from '../../run/recruitment';
import { getTypeColor } from '../combat/typeColors';
import { ELEMENT_PATHS } from '../shared/elementIcons';
import { WHEEL_STEP_DEG, WHEEL_TYPES } from '../shared/TypeWheel';

// The Constellation's sky (docs/collection.md §4): every hero in the catalog is a star, each type a
// constellation on its own spoke. A hero owned burns in its type's colour; one still in the sky is
// a cold point. The figure is the collection, read at a glance — and what the Starfall fills in.

const SIZE = 360;
const C = SIZE / 2;
const INNER = 60;
const STEP = 16.5;
const SIGIL_R = 163;
const GLYPH = 13;

/** FNV-1a, for a fixed wobble per star. */
function hash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
}

function polar(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

interface SkyStar {
  heroId: string;
  x: number;
  y: number;
}

/** The figure is fixed: the same sky every visit, so a newly lit star is read against a known shape. */
const CLUSTERS: { type: TypeId; deg: number; sigil: [number, number]; stars: SkyStar[] }[] = WHEEL_TYPES.map((type, i) => {
  const deg = -90 + i * WHEEL_STEP_DEG;
  const members = Object.values(heroes).filter((hero) => hero.types[0] === type);
  return {
    type,
    deg,
    sigil: polar(deg, SIGIL_R),
    stars: members.map((hero, j) => {
      const h = hash(hero.id);
      const swing = (j % 2 === 0 ? 1 : -1) * (3 + (h % 5));
      const [x, y] = polar(deg + swing, INNER + j * STEP + ((h >> 4) % 5) - 2);
      return { heroId: hero.id, x, y };
    }),
  };
});

/** Every star the sky holds. */
export const SKY_HERO_COUNT = CLUSTERS.reduce((n, c) => n + c.stars.length, 0);

interface Props {
  purchases: readonly string[];
  /** A hero just fallen: its star flares when the sky is next seen. */
  freshId?: string | null;
  onPeekHero: (heroId: string) => void;
  /** The thing at the sky's centre — the Lodestar the player calls a star down with. */
  children?: ReactNode;
}

export function StarSky({ purchases, freshId, onPeekHero, children }: Props) {
  const owns = (id: string) => ownsHero(id, heroes[id], purchases);

  return (
    <div className="star-sky">
      <svg className="star-sky-chart" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-label="Your heroes, as stars">
        <defs>
          <radialGradient id="star-sky-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe9b0" stopOpacity="0.28" />
            <stop offset="45%" stopColor="#c89a4a" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={C} cy={C} r={150} fill="url(#star-sky-core)" />
        <g className="star-sky-rings" fill="none">
          <circle className="star-sky-ring is-outer" cx={C} cy={C} r={150} />
          <circle className="star-sky-ring is-ticks" cx={C} cy={C} r={146} />
          <circle className="star-sky-ring is-inner" cx={C} cy={C} r={INNER - 12} />
        </g>

        {CLUSTERS.map((cluster) => {
          const color = getTypeColor(cluster.type);
          const owned = cluster.stars.filter((s) => owns(s.heroId)).length;
          const whole = owned === cluster.stars.length;
          return (
            <g key={cluster.type} className={`star-sky-cluster${whole ? ' is-whole' : ''}`} style={{ '--type-color': color } as CSSProperties}>
              {cluster.stars.slice(1).map((s, j) => {
                const prev = cluster.stars[j];
                const lit = owns(s.heroId) && owns(prev.heroId);
                return <line key={s.heroId} className={`star-sky-link${lit ? ' is-lit' : ''}`} x1={prev.x} y1={prev.y} x2={s.x} y2={s.y} />;
              })}
              {cluster.stars.map((s, j) => {
                const lit = owns(s.heroId);
                const fresh = s.heroId === freshId;
                return (
                  <g
                    key={s.heroId}
                    className={`star-sky-star${lit ? ' is-lit' : ''}${fresh ? ' is-fresh' : ''}`}
                    transform={`translate(${s.x} ${s.y})`}
                    style={{ '--twinkle': `${(hash(s.heroId) % 40) / 10}s` } as CSSProperties}
                    role="button"
                    aria-label={`${heroes[s.heroId].name}${lit ? '' : ' — still in the sky'}`}
                    onClick={() => onPeekHero(s.heroId)}
                  >
                    <circle className="star-sky-hit" r={8} />
                    {lit && <circle className="star-sky-halo" r={7 + (j === cluster.stars.length - 1 ? 1 : 0)} />}
                    {fresh && <circle className="star-sky-flare" r={6} />}
                    <circle className="star-sky-core" r={lit ? 2.6 : 1.5} />
                  </g>
                );
              })}
              <g transform={`translate(${cluster.sigil[0]} ${cluster.sigil[1]})`} className="star-sky-sigil" style={{ '--fill': owned / cluster.stars.length } as CSSProperties}>
                <circle r={11} />
                <svg x={-GLYPH / 2} y={-GLYPH / 2} width={GLYPH} height={GLYPH} viewBox="0 0 24 24" fill="currentColor">
                  {ELEMENT_PATHS[cluster.type]}
                </svg>
              </g>
            </g>
          );
        })}
      </svg>
      {children && <div className="star-sky-centre">{children}</div>}
    </div>
  );
}
