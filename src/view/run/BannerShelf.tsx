import { useState, type CSSProperties } from 'react';
import { relics } from '../../data/relics';
import type { RunState } from '../../run/state';
import { RelicArt } from '../shared/relicArt';
import { relicColor } from '../shared/relicIcons';
import { stackedGrantSummary } from '../shared/relicStacks';

/**
 * What the run has RAISED, flown along the bottom-right of the map (2026-09-10, per user
 * direction). It replaces the Banner rail that sat on top of the Roster sheet.
 *
 * The rail showed all five whether held or not, and it did that so spreading-vs-committing would
 * be a visible decision from act 1 — but the decision is made on the Guardian's own 1-of-5 screen,
 * which shows all five anyway, and the rail was charging the gear screen its whole first fold to
 * restate a choice that had already been taken. Here it costs nothing: the map's bottom-right is
 * empty scenery, and a Banner is a standard, which is a thing you plant in a place.
 *
 * So this is the OPPOSITE reading of the same data: only what is held, folded with its count, in
 * the order the run won it. An act-1 run flies nothing, which is correct — it has raised nothing.
 */
function countHoldings(run: RunState): { id: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const id of run.relics) {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return order.map((id) => ({ id, count: counts.get(id) ?? 0 }));
}

/** What a standard's tap opens: which Banner, how many are flying, and what that adds up to. */
function BannerSummaryPopup({ relicId, count, onClose }: { relicId: string | null; count: number; onClose: () => void }) {
  const relic = relicId ? relics[relicId] : null;
  if (!relicId || !relic) return null;
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
          <span className="relic-summary-name">{relic.name}</span>
        </div>
        <div className="relic-summary-grant">Team-wide {stackedGrantSummary(relic, Math.max(count, 1))}.</div>
        <div className="relic-summary-count">Flying ×{count}</div>
        <div className="move-popup-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}

export function BannerShelf({ run }: { run: RunState }) {
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const held = countHoldings(run);
  if (held.length === 0) return null;

  return (
    <>
      <div className="banner-shelf" aria-label={`${held.length} Banners raised`}>
        {held.map(({ id, count }, i) => (
          <button
            key={id}
            type="button"
            className="banner-shelf-pole"
            // Staggered, so the row sways like cloth in one wind rather than in five.
            style={{ '--relic-color': relicColor(id), '--sway-delay': `${i * 340}ms` } as CSSProperties}
            onClick={() => setInspectingId(id)}
            aria-label={`${relics[id]?.name ?? id}, flying ${count} — tap for details`}
          >
            <RelicArt relicId={id} className="banner-shelf-art" />
            {/* Only past one: a lone standard's "1" is a number saying nothing. */}
            {count > 1 && <span className="banner-shelf-count">{count}</span>}
          </button>
        ))}
      </div>
      <BannerSummaryPopup
        relicId={inspectingId}
        count={inspectingId ? held.find((h) => h.id === inspectingId)?.count ?? 0 : 0}
        onClose={() => setInspectingId(null)}
      />
    </>
  );
}
