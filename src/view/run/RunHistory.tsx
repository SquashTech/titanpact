import { useState } from 'react';
import { rosterHeroes } from '../../data/content';
import { locations } from '../../data/locations';
import { progressionTable } from '../../data/progression';
import { companionStarId, companionTypeOf, formatPlaytime, type RunRecord, type RunRecordHero } from '../../run/profile';
import { SEAL_ACTS } from '../../run/state';
import { HeroPortrait } from '../shared/HeroPortrait';

const ACT_ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** "Cleared" or how far a wipe got — the finale is past the fifth seal, so it is named, not counted. */
function headline(record: RunRecord): string {
  if (record.outcome === 'win') return 'Cleared';
  return record.actReached > SEAL_ACTS ? 'Fell at the last pact' : `Fell in Act ${ACT_ROMAN[record.actReached - 1] ?? record.actReached}`;
}

/** "16 Sep", with the year once it is not this one — a keepsake date, not a timestamp. */
function formatRunDate(ms: number): string {
  if (ms <= 0) return '';
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** The star this hero could have earned on the run: its form's, or its line's for a companion. */
function starIdOf(hero: RunRecordHero): string | null {
  const type = companionTypeOf(hero.heroId);
  return type ? companionStarId(type) : hero.evolutionPathId;
}

function pathName(hero: RunRecordHero): string | null {
  if (!hero.evolutionPathId) return null;
  for (const node of progressionTable.evolutions[hero.heroId] ?? []) {
    const path = node.paths.find((p) => p.id === hero.evolutionPathId);
    if (path) return path.name;
  }
  return null;
}

/**
 * One finished run, folded to a line — the outcome, where and when, the team's faces — and
 * opened on a tap to the roster by name, level and form. The same facts the summary screen
 * showed the night it happened, kept.
 */
function RunHistoryRow({ record }: { record: RunRecord }) {
  const [open, setOpen] = useState(false);
  const place = record.locationId ? locations[record.locationId] : null;
  const where = record.actReached > SEAL_ACTS ? "The Titan's Eyes" : place?.name ?? null;
  const facts = [
    where,
    record.durationMs !== null ? formatPlaytime(record.durationMs) : null,
    `${record.encountersWon} ${record.encountersWon === 1 ? 'fight' : 'fights'} won`,
  ].filter((f): f is string => !!f);

  return (
    <div className={`run-history-row is-${record.outcome}${open ? ' is-open' : ''}`}>
      <button type="button" className="run-history-head" data-sfx="ui.select" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="run-history-mark" aria-hidden="true">
          {record.outcome === 'win' ? '✦' : '✕'}
        </span>
        <span className="run-history-body">
          <span className="run-history-title-line">
            <span className="run-history-title">{headline(record)}</span>
            <span className="run-history-date">{formatRunDate(record.endedAt)}</span>
          </span>
          <span className="run-history-facts">{facts.join(' · ')}</span>
          <span className="run-history-faces">
            {record.roster.map((hero, i) =>
              rosterHeroes[hero.heroId] ? (
                <span key={`${hero.heroId}-${i}`} className="run-history-face" title={rosterHeroes[hero.heroId].name}>
                  <HeroPortrait heroId={hero.heroId} className="run-history-portrait" />
                  {record.starsEarned.includes(starIdOf(hero) ?? '') && (
                    <span className="run-history-face-star" aria-hidden="true">
                      ★
                    </span>
                  )}
                </span>
              ) : null
            )}
            {record.starsEarned.length > 0 && (
              <span className="run-history-stars" title={`${record.starsEarned.length} new ${record.starsEarned.length === 1 ? 'star' : 'stars'}`}>
                ★ {record.starsEarned.length}
              </span>
            )}
          </span>
        </span>
      </button>

      {open && (
        <div className="run-history-detail">
          {record.roster.map((hero, i) => {
            const def = rosterHeroes[hero.heroId];
            if (!def) return null;
            const form = pathName(hero);
            const newStar = record.starsEarned.includes(starIdOf(hero) ?? '');
            return (
              <div key={`${hero.heroId}-${i}`} className="run-history-hero">
                <HeroPortrait heroId={hero.heroId} className="run-history-portrait" />
                <span className="run-history-hero-name">{def.name}</span>
                <span className="run-history-hero-meta">
                  Lv {hero.level}
                  {form ? ` · ${form}` : ''}
                  {newStar && <span className="run-history-hero-star"> ★</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Every run that ended, newest first (profile.ts `runHistory`). */
export function RunHistory({ records }: { records: readonly RunRecord[] }) {
  if (records.length === 0) {
    return <p className="records-note">No run has ended yet. Every clear and every wipe is kept here.</p>;
  }
  return (
    <div className="run-history">
      {records.map((record, i) => (
        <RunHistoryRow key={`${record.endedAt}-${i}`} record={record} />
      ))}
    </div>
  );
}
