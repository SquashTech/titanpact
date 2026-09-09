import { useState, type CSSProperties } from 'react';
import { gemList, gemStatGrants, gems } from '../../data/gems';
import { guardianBannerRelics, relics } from '../../data/relics';
import type { RunState } from '../../run/state';
import { RelicArt } from '../shared/relicArt';
import { relicColor } from '../shared/relicIcons';
import { stackedGrantSummary, type StackableGrant } from '../shared/relicStacks';

/**
 * One chip per Banner and per Gem, carrying its count. Banners are owned copies; a Gem's count
 * is what the RUN has collected, wherever those stones currently sit on the roster.
 */
function countHoldings(run: RunState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of run.relics) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const gem of gemList) counts.set(gem.id, run.gemsEarned[gem.stat] ?? 0);
  return counts;
}

/** Whichever catalog the id belongs to, in the one shape the chips and the popup read. */
function holdingFor(id: string): StackableGrant | null {
  const gem = gems[id];
  if (gem) return { name: gem.name, statGrants: gemStatGrants(gem) };
  return relics[id] ?? null;
}

/**
 * One relic family's chips: icon and count, nothing else. Held or not — a run collects Gems
 * steadily and meets the same five Banners every act, so an unheld one is a slot to fill rather
 * than an absence, and the Banners being FIXED only becomes a spread-or-commit decision if all
 * five are visible from act 1.
 *
 * Names and grants are one tap away rather than spelled out (2026-09-07, per user direction).
 * Twelve of these live above the roster on one scroll; written out in full they were the whole
 * first screen, and the roster — the half of this sheet you can actually act on — was below the
 * fold. An icon and a number is the reading a player wants at a glance; the detail is for the one
 * they are actually deciding about.
 */
function RelicRail({
  label,
  family,
  counts,
  onInspect,
  variant,
}: {
  label: string;
  family: readonly { id: string; name: string }[];
  counts: Map<string, number>;
  onInspect: (relicId: string) => void;
  /** Which family's sizing the rail takes — five Banners across one line, seven Gems across two. */
  variant: 'banners' | 'gems';
}) {
  return (
    <div className="relic-rail-row">
      <span className="relic-rail-label">{label}</span>
      <div className={`relic-rail is-${variant}`}>
        {family.map((relic) => {
          const count = counts.get(relic.id) ?? 0;
          return (
            <button
              key={relic.id}
              type="button"
              className={`relic-pill${count > 0 ? '' : ' is-empty'}`}
              style={{ '--relic-color': relicColor(relic.id) } as CSSProperties}
              onClick={() => onInspect(relic.id)}
              aria-label={`${relic.name}, held ${count} — tap for details`}
            >
              <RelicArt relicId={relic.id} className="relic-pill-art" />
              <span className="relic-pill-count">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What a chip's tap opens: which relic it is, how many are held, and what that adds up to. */
function RelicSummaryPopup({ relicId, count, onClose }: { relicId: string | null; count: number; onClose: () => void }) {
  const relic = relicId ? holdingFor(relicId) : null;
  if (!relicId || !relic) return null;
  // A Gem is poured into one hero; a Banner stands over the whole team. The line has to say which.
  const scope = gems[relicId] ? 'Per hero' : 'Team-wide';
  return (
    <div
      className="log-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="log-panel move-popup-panel">
        <div className="relic-summary-head">
          <RelicArt relicId={relicId} className="relic-summary-art" />
          {/* The plain name, not `stackedRelicName`: the "+1" suffix and the Held line below say
              the same thing in two notations. The suffix is for chips with no room for a count. */}
          <span className="relic-summary-name">{relic.name}</span>
        </div>
        {/* A held stack states its summed total; an unheld one states what a single copy would pay. */}
        <div className="relic-summary-grant">
          {scope} {stackedGrantSummary(relic, Math.max(count, 1))}.
        </div>
        <div className="relic-summary-count">{count > 0 ? `Held ×${count}` : 'Not held yet'}</div>
        <div className="move-popup-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}

/**
 * The team-wide half of the run sheet: what every hero carries before a single item is equipped.
 * It sits at the top of the roster screen rather than behind a map button of its own (2026-09-07)
 * — the Banners, the Gems and the gear they stack with are one question, so they are one screen.
 */
export function RunRelicsPanel({ run }: { run: RunState }) {
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const counts = countHoldings(run);

  return (
    <section className="run-relics-panel">
      <RelicRail label="Banners" family={guardianBannerRelics} counts={counts} onInspect={setInspectingId} variant="banners" />
      <RelicRail label="Gems" family={gemList} counts={counts} onInspect={setInspectingId} variant="gems" />
      <RelicSummaryPopup
        relicId={inspectingId}
        count={inspectingId ? counts.get(inspectingId) ?? 0 : 0}
        onClose={() => setInspectingId(null)}
      />
    </section>
  );
}
