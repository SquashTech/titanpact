import { useMemo, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import type { HeroDefinition, StatKey } from '../../engine/content';
import { createRosterEntry } from '../../run/state';
import { STARTER_PICK_COUNT } from '../../run/draft';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { STAT_COLORS, STAT_LABELS, computeBst, statFraction } from '../shared/StatBars';

interface Props {
  optionIds: string[];
  onConfirm: (chosenIds: string[]) => void;
}

const MOTE_COUNT = 16;

/**
 * The six combat stats, in the same order StatBars uses. Mana Pool / MP Regen
 * are deliberately absent: they're the separate tempo axis (CLAUDE.md "Mana &
 * tempo"), and this strip exists to be compared across four candidates at a
 * glance — eight bars is a spec sheet, six is a silhouette. The full block is
 * one tap away on the hero sheet.
 */
const SILHOUETTE_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

/**
 * Ambient motes drifting up the whole screen — same golden-angle-sequence
 * trick as TitleScreen's useEmbers (pure function of index, so the scatter is
 * stable across re-renders with no seed to store). They take the featured
 * hero's type color from `--pact-rgb`, so switching candidates re-tints the
 * air as well as the figure.
 */
function useMotes() {
  return useMemo(
    () =>
      Array.from({ length: MOTE_COUNT }, (_, i) => {
        const seed = i * 137.51;
        return {
          left: seed % 100,
          delay: (seed * 1.3) % 7,
          duration: 5.5 + ((seed * 0.29) % 4),
          size: 2 + ((seed * 0.17) % 2),
        };
      }),
    []
  );
}

/**
 * Start-of-run draft: pick 2 of 4 random candidates (App.tsx's opening
 * screen, replacing a fixed cinderKnight+tidecaller opener — CLAUDE.md
 * "every hero must be viable", so runs shouldn't always begin identically).
 *
 * Rebuilt 2026-08-25 as a *stage* rather than a grid of cards, applying
 * docs/visual-language.md's rule ("a rectangle means you can act on this")
 * outside combat for the first time — its open item 6. The old screen spent
 * 227px on a flavor banner and then showed each candidate as a 158x112 card
 * carrying a 40px sprite, a name and two type chips: nothing to look at and
 * nothing to decide with, so the pick was uninformed unless the player dug
 * through the info overlay. It read, accurately, as clicking boxes.
 *
 * Now one candidate at a time stands at 144px (a clean 3x of the 48px
 * sources — the scale docs/visual-language.md item 5 wanted to try and could
 * never afford on a battlefield holding four figures) inside a summoning
 * sigil, with the stat silhouette and starting kit that actually inform the
 * choice. The rail below is the roster of candidates; tapping one brings it
 * to the stage, and the stage's own button is what commits. Two taps per
 * pick, on the most consequential decision of the run — the ceremony is the
 * point.
 *
 * Candidates are unrecruited (no roster entry yet), so the info-button
 * preview synthesizes a throwaway level-1 RosterEntry the same way
 * SquadSelectScreen does for real roster members.
 */
export function DraftScreen({ optionIds, onConfirm }: Props) {
  const [featuredId, setFeaturedId] = useState<string>(optionIds[0]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState<HeroDefinition | null>(null);
  const motes = useMotes();

  const featured = heroes[featuredId];
  const featuredRgb = getTypeColorRgb(featured.types[0]);
  const featuredChosen = pickedIds.includes(featuredId);
  const pactFull = pickedIds.length >= STARTER_PICK_COUNT;
  const complete = pickedIds.length === STARTER_PICK_COUNT;

  function toggle(heroId: string) {
    setPickedIds((prev) => {
      if (prev.includes(heroId)) return prev.filter((id) => id !== heroId);
      if (prev.length >= STARTER_PICK_COUNT) return prev;
      return [...prev, heroId];
    });
  }

  return (
    <div className="draft-screen" style={{ '--pact-rgb': featuredRgb } as CSSProperties}>
      {/* The scene itself: a type-tinted wash and a mote field, both full-bleed
          past .app-shell's padding. Not a container — nothing sits "in" it. */}
      <div className="draft-sky" aria-hidden="true">
        <span className="draft-sky-wash" />
        <div className="draft-motes">
          {motes.map((m, i) => (
            <span
              key={i}
              className="draft-mote"
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

      <header className="draft-header">
        <div className="draft-eyebrow">A Titan Stirs</div>
        <h2 className="draft-title">
          <span className="draft-title-glow" aria-hidden="true">
            Forge Your Pact
          </span>
          Forge Your Pact
        </h2>
        <p className="draft-flavor">Two will carry a fraction of its power. Choose them.</p>
        {/* The pick counter as two sockets that fill with the chosen hero's own
            sprite, rather than an "(n/2)" in a section heading. Same pip-track
            idiom as the Field Effect plaque's duration clock: a fixed
            denominator the player learns the shape of once. */}
        <div className="draft-sockets" aria-label={`${pickedIds.length} of ${STARTER_PICK_COUNT} allies chosen`}>
          {Array.from({ length: STARTER_PICK_COUNT }, (_, i) => {
            const id = pickedIds[i];
            const hero = id ? heroes[id] : null;
            return (
              <span
                key={i}
                className={`draft-socket${hero ? ' filled' : ''}`}
                style={hero ? ({ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties) : undefined}
                title={hero?.name}
              >
                {hero ? (
                  <HeroPortrait heroId={hero.id} className="draft-socket-portrait" />
                ) : (
                  <span className="draft-socket-mark" aria-hidden="true">
                    ◆
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </header>

      <div className="draft-stage">
        {/* Keyed on the featured hero so switching candidates remounts the
            figure and replays its arrival — a new hero should read as summoned
            in, not as a swapped <img src>. */}
        <div className="draft-figure" key={featuredId}>
          <span className="draft-sigil" aria-hidden="true" />
          <HeroPortrait heroId={featured.id} className="draft-portrait" />
          <button
            className="draft-info"
            onClick={() => setInspecting(featured)}
            aria-label={`View ${featured.name} details`}
          >
            i
          </button>
        </div>

        <div className="draft-ident" key={`${featuredId}-ident`}>
          <h3 className="draft-name">{featured.name}</h3>
          <div className="draft-types">
            {featured.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>

          <div className="draft-silhouette">
            {SILHOUETTE_STATS.map((stat) => {
              const value = featured.baseStats[stat];
              return (
                <div className="draft-stat" key={stat}>
                  <span className="draft-stat-value">{value}</span>
                  <div className="draft-stat-track">
                    <div
                      className="draft-stat-fill"
                      style={{ height: `${statFraction(stat, value) * 100}%`, background: STAT_COLORS[stat] }}
                    />
                  </div>
                  <span className="draft-stat-label">{STAT_LABELS[stat]}</span>
                </div>
              );
            })}
            <div className="draft-stat draft-stat-bst" title="Base Stat Total">
              <span className="draft-stat-value">{computeBst(featured.baseStats)}</span>
              <div className="draft-stat-track draft-stat-track-empty" />
              <span className="draft-stat-label">BST</span>
            </div>
          </div>

          {/* Starting kit, drawn as the move buttons with their boxes taken
              off: the same mana crystal the move grid uses, and the type
              carried as the name's own color rather than a separate chip. */}
          <div className="draft-kit">
            {featured.moveIds.map((moveId) => {
              const move = moves[moveId];
              if (!move) return null;
              return (
                <span
                  className="draft-kit-move"
                  key={moveId}
                  style={{ '--move-type': getTypeColor(move.type) } as CSSProperties}
                >
                  <span className="draft-kit-crystal" title={`${move.manaCost} Mana`}>
                    {move.manaCost}
                  </span>
                  {move.name}
                </span>
              );
            })}
          </div>
        </div>

        <button
          className={`draft-choose${featuredChosen ? ' chosen' : ''}`}
          disabled={!featuredChosen && pactFull}
          onClick={() => toggle(featuredId)}
        >
          {featuredChosen ? `✦ ${featured.name} is bound` : pactFull ? 'Pact is full' : `Choose ${featured.name}`}
        </button>
      </div>

      {/* The other candidates, waiting in the dark. Chromeless at rest — the
          frame is the affordance, and it appears on the one that's on stage
          (docs/visual-language.md). */}
      <div className="draft-rail">
        {optionIds.map((heroId) => {
          const hero = heroes[heroId];
          const chosen = pickedIds.includes(heroId);
          return (
            <button
              key={heroId}
              className={`draft-candidate${heroId === featuredId ? ' featured' : ''}${chosen ? ' chosen' : ''}`}
              style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
              onClick={() => setFeaturedId(heroId)}
              aria-pressed={heroId === featuredId}
            >
              <HeroPortrait heroId={hero.id} className="draft-candidate-portrait" />
              <span className="draft-candidate-name">{hero.name}</span>
              {chosen && (
                <span className="draft-candidate-seal" aria-hidden="true">
                  ✦
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button className="resolve-button draft-cta" disabled={!complete} onClick={() => onConfirm(pickedIds)}>
        {complete ? 'Seal the Pact' : `Choose ${STARTER_PICK_COUNT - pickedIds.length} more`}
      </button>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting}
          entry={createRosterEntry(inspecting.id, inspecting.id, inspecting.moveIds)}
          equipmentLookup={{}}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}
