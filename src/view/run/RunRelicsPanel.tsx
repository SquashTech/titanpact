import { useState } from 'react';
import { gemRelics, guardianBannerRelics, relics } from '../../data/relics';
import type { RelicDefinition } from '../../run/relics';
import { RelicIcon } from '../shared/EquipmentBox';
import { stackedGrantSummary } from '../shared/relicStacks';

/** Duplicates fold into one chip carrying the count. */
function countRelics(ownedRelicIds: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ownedRelicIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
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
  family: readonly RelicDefinition[];
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
              onClick={() => onInspect(relic.id)}
              aria-label={`${relic.name}, held ${count} — tap for details`}
            >
              <RelicIcon relicId={relic.id} className="relic-pill-icon" />
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
  const relic = relicId ? relics[relicId] : null;
  if (!relic) return null;
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
          <RelicIcon relicId={relic.id} className="relic-summary-icon" />
          {/* The plain name, not `stackedRelicName`: the "+1" suffix and the Held line below say
              the same thing in two notations. The suffix is for chips with no room for a count. */}
          <span className="relic-summary-name">{relic.name}</span>
        </div>
        {/* A held stack states its summed total; an unheld one states what a single copy would pay. */}
        <div className="relic-summary-grant">Team-wide {stackedGrantSummary(relic, Math.max(count, 1))}.</div>
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
export function RunRelicsPanel({ ownedRelicIds }: { ownedRelicIds: readonly string[] }) {
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const counts = countRelics(ownedRelicIds);

  return (
    <section className="run-relics-panel">
      <RelicRail label="Banners" family={guardianBannerRelics} counts={counts} onInspect={setInspectingId} variant="banners" />
      <RelicRail label="Gems" family={gemRelics} counts={counts} onInspect={setInspectingId} variant="gems" />
      <RelicSummaryPopup
        relicId={inspectingId}
        count={inspectingId ? counts.get(inspectingId) ?? 0 : 0}
        onClose={() => setInspectingId(null)}
      />
    </section>
  );
}
