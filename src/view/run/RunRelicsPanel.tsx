import { useMemo } from 'react';
import { gemRelics, guardianBannerRelics, relics } from '../../data/relics';
import { passives } from '../../data/passives';
import type { StatKey } from '../../engine/content';
import type { RelicDefinition } from '../../run/relics';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { relicStatContribution } from '../../run/entryStats';
import { RelicIcon } from '../shared/EquipmentBox';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { stackedGrantSummary } from '../shared/relicStacks';

/** Duplicates fold into one chip carrying the count. */
function countRelics(ownedRelicIds: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ownedRelicIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * One relic family's chips. Held or not: a run collects Gems steadily and meets the same five
 * Banners every act, so an unheld one is a slot to fill rather than an absence — and the Banners
 * being FIXED only becomes a spread-or-commit decision if all five are visible from act 1.
 *
 * Name and count only. What each one grants is stated where it is offered (GemChoiceScreen,
 * GuardianBannerScreen) and again, summed and applied, in the totals row below — a per-chip
 * grant line is the third telling, and it pushed the roster this panel sits above off-screen.
 */
function RelicRail({ label, family, counts }: { label: string; family: readonly RelicDefinition[]; counts: Map<string, number> }) {
  return (
    <div className="relic-rail-row">
      <span className="relic-rail-label">{label}</span>
      <div className="relic-rail">
        {family.map((relic) => {
          const count = counts.get(relic.id) ?? 0;
          return (
            <span
              key={relic.id}
              className={`relic-pill${count > 0 ? '' : ' is-empty'}`}
              title={`${relic.name} — team-wide ${stackedGrantSummary(relic, Math.max(count, 1))}${count > 1 ? ` (×${count})` : ''}`}
            >
              <RelicIcon relicId={relic.id} className="relic-pill-icon" />
              {relic.name}
              <span className="relic-pill-count">×{count}</span>
            </span>
          );
        })}
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
  const counts = countRelics(ownedRelicIds);
  const totals = useMemo(
    () =>
      Object.entries(
        relicStatContribution(relicTeamStatModifiers(ownedRelicIds, relics), relicTeamPassiveGrants(ownedRelicIds, relics), passives)
      ) as [StatKey, number][],
    [ownedRelicIds]
  );

  return (
    <section className="run-relics-panel">
      <RelicRail label="Banners" family={guardianBannerRelics} counts={counts} />
      <RelicRail label="Gems" family={gemRelics} counts={counts} />
      <div className="relic-active-banner">
        <span className="relic-active-banner-label">Every hero carries</span>
        {totals.length > 0 ? (
          totals.map(([stat, amount]) => (
            <span key={stat} className="relic-contrib-chip">
              <StatGlyph stat={stat} /> {STAT_LABELS[stat]} {amount > 0 ? `+${amount}` : amount}
            </span>
          ))
        ) : (
          <span className="relic-active-banner-note">Nothing yet — Gems drop from fights, Banners from Guardians.</span>
        )}
      </div>
    </section>
  );
}
