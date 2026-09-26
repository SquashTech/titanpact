import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { progressionTable } from '../../data/progression';
import { titanspawnLines } from '../../data/titanspawn';
import { formatPlaytime, starredHeroCount, totalStars, type Profile } from '../../run/profile';
import { SEAL_ACTS } from '../../run/state';
import { HubGlyph } from '../shared/nodeIcons';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { RunHistory } from './RunHistory';

interface Props {
  profile: Profile;
  /** Erases the profile and any parked run, then hands back a fresh profile to render. */
  onEraseAllData: () => void;
  onClose: () => void;
}

const ACT_ROMAN = ['I', 'II', 'III', 'IV', 'V'];

type RecordsTab = 'records' | 'history';

const TABS: readonly TabSpec<RecordsTab>[] = [
  { id: 'records', label: 'Records', glyph: 'records' },
  { id: 'history', label: 'Run History', glyph: 'history' },
];

const HERO_COUNT = Object.keys(heroes).length;
/** Every Evolution path in the game, and a companion star a Titanspawn line — the ceiling on stars. */
const STAR_COUNT =
  Object.values(progressionTable.evolutions).reduce((n, nodes) => n + nodes.reduce((m, node) => m + node.paths.length, 0), 0) + titanspawnLines.length;

/**
 * One line of the record. It was a tile — a big accent numeral over a small caps label, in a
 * bordered box, laid out two-up — which is a SaaS analytics dashboard's KPI grid and nothing else.
 * A lifetime record is a ledger: the thing it was written in reads left to right, the figure sits
 * at the far end, and a run of leader dots carries the eye across. No box, because a record is not
 * something you can act on.
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ledger-line">
      <span className="ledger-label">{label}</span>
      <span className="ledger-lead" aria-hidden="true" />
      <span className="ledger-value">{value}</span>
    </div>
  );
}

/**
 * Lifetime figures, read once when this opens (profileStorage is not React state). Stars
 * themselves live on the Compendium tiles — this screen only counts them, so the two are
 * not two places to keep the same list. The Compendium's sheet (CompendiumScreen), page for
 * page: title bar, well, the strip at the foot, one Close under the panel.
 */
export function RecordsScreen({ profile, onEraseAllData, onClose }: Props) {
  // Two taps: this is the only control in the game that destroys something unrecoverable.
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [tab, setTab] = useState<RecordsTab>('records');

  const cleared = profile.runsCompleted;
  const played = profile.runsStarted;
  const winRate = played > 0 ? `${Math.round((cleared / played) * 100)}%` : '—';

  return (
    <div className="detail-overlay is-sheet" onClick={onClose}>
      <div className="detail-panel is-tabbed is-hero-sheet compendium-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header is-hero compendium-head">
          <span className="detail-portrait-plate compendium-head-plate" aria-hidden="true">
            <HubGlyph name="trophy" className="compendium-head-glyph" />
          </span>
          <span className="detail-name compendium-head-title">Records</span>
        </div>

        {/* Keyed on the page so a switch scrolls the well back to its top. */}
        <div key={tab} className="detail-tab-body compendium-body" role="tabpanel">
          {tab === 'history' ? (
            <RunHistory records={profile.runHistory} />
          ) : (
            <>
              <div className="ledger">
                <Stat label="Playtime" value={formatPlaytime(profile.playtimeMs)} />
                <Stat label="Runs started" value={String(played)} />
                <Stat label="Runs cleared" value={String(cleared)} />
                <Stat label="Runs lost" value={String(profile.runsFailed)} />
                <Stat label="Clear rate" value={winRate} />
                <Stat
                  label="Furthest act"
                  value={
                    profile.furthestAct > SEAL_ACTS
                      ? 'Finale'
                      : `${ACT_ROMAN[profile.furthestAct - 1] ?? profile.furthestAct} / ${SEAL_ACTS}`
                  }
                />
              </div>

              <div className="tab-subhead">Stars</div>
              {/* Was a two-sentence paragraph explaining what a star is and where to see one. The
                  second half is a navigation instruction the Compendium answers by having them on it;
                  the first half is what a star MEANS, which is the only part a record needs. */}
              <p className="records-note">One for every Evolution a run has been cleared in — three a hero.</p>
              <div className="ledger">
                <Stat label="Stars earned" value={`${totalStars(profile)} / ${STAR_COUNT}`} />
                <Stat label="Heroes starred" value={`${starredHeroCount(profile)} / ${HERO_COUNT}`} />
              </div>

              <div className="tab-subhead">Data</div>
              <button
                className={`options-item options-item-danger${confirmingErase ? ' armed' : ''}`}
                onClick={() => {
                  if (!confirmingErase) {
                    setConfirmingErase(true);
                    return;
                  }
                  setConfirmingErase(false);
                  onEraseAllData();
                }}
              >
                <span className="options-item-glyph" aria-hidden="true">
                  <HubGlyph name={confirmingErase ? 'warn' : 'discard'} />
                </span>
                {confirmingErase ? 'Tap again to erase everything' : 'Erase All Data'}
              </button>
              <p className="records-note">
                {confirmingErase
                  ? 'Records, stars and any parked run are deleted. This cannot be undone.'
                  : 'Clears these records, every star, the run history, and any parked run. Sound settings are kept.'}
              </p>
            </>
          )}
        </div>

        <TabStrip tabs={TABS} active={tab} onSelect={setTab} />
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="resolve-button sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
