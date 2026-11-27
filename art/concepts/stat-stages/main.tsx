import type { CSSProperties } from 'react';
import ReactDOM from 'react-dom/client';
import '../../../src/app/styles.css';
import '../../../src/app/storybook.css';
import './skins.css';
import type { StatKey } from '../../../src/engine/content';
import { STAT_COLORS, StatGlyph } from '../../../src/view/shared/statIcons';
import { StatusGlyph, statusColor, statusTint } from '../../../src/view/shared/statusIcons';

// The stat-stage badge under the nameplate, beside a status chip, as it is now and in three storybook looks.
const SKINS = [
  { id: 'now', name: 'Now', note: 'Dark pills, gold up and slate down, a bar a step.' },
  { id: 'a', name: 'A · Paper pill', note: 'A cream pill with an ink rim; the stat in its own colour, then a chevron a step in gold up or slate down.' },
  { id: 'b', name: 'B · Candy', note: 'The pill is filled gold up or slate down, everything on it white with an ink rim, like the type chips.' },
  { id: 'c', name: 'C · Stat bubble', note: 'The stat in a disc of its own colour, a gold or slate tag on its shoulder carrying a chevron a step.' },
];

type Mod = { stat: StatKey; dir: 1 | -1; steps: number; held?: boolean };
const ROWS: Mod[][] = [
  [{ stat: 'intelligence', dir: 1, steps: 1 }],
  [{ stat: 'attack', dir: 1, steps: 2 }, { stat: 'speed', dir: -1, steps: 1 }],
  [{ stat: 'defense', dir: -1, steps: 5, held: true }, { stat: 'wisdom', dir: 1, steps: 3 }],
];
const STATUS = ['Burn', '', 'Poison'];

function Badge({ stat, dir, steps, held }: Mod) {
  return (
    <span className={`stat-mod-badge ${dir > 0 ? 'stat-buff' : 'stat-debuff'}${held ? ' stat-held' : ''}`} style={{ '--stat-color': STAT_COLORS[stat] } as CSSProperties}>
      <span className="ss-disc">
        <StatGlyph stat={stat} tone="inherit" className="stat-mod-glyph" />
      </span>
      <span className="stat-mod-arrow" aria-hidden="true">{dir > 0 ? '▲' : '▼'}</span>
      <span className="stat-mod-pips" aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => <span key={i} className="stat-mod-pip" />)}
      </span>
      <span className="ss-chevrons" aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => <span key={i} className="ss-chevron">{dir > 0 ? '▲' : '▼'}</span>)}
      </span>
    </span>
  );
}

function Chip({ id }: { id: string }) {
  return (
    <span className="status-badge" style={{ color: statusColor(id), background: statusTint(id, 0.16), borderColor: statusTint(id, 0.55) }}>
      <StatusGlyph statusId={id} />
    </span>
  );
}

function Page() {
  return (
    <div className="ss-page">
      <h1 className="ss-title">Stat stages</h1>
      <div className="ss-grid">
        {SKINS.map((skin) => (
          <section key={skin.id} className={`ss-col skin-${skin.id}`}>
            <h2>{skin.name}</h2>
            <p>{skin.note}</p>
            <div className="ss-field team-row ally">
              {ROWS.map((mods, i) => (
                <div key={i} className="ss-hero">
                  <div className="ss-plate" />
                  <div className="status-badge-row">
                    <div className="status-badge-fit">
                      {STATUS[i] && <Chip id={STATUS[i]} />}
                      {mods.map((m) => <Badge key={m.stat} {...m} />)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Page />);
