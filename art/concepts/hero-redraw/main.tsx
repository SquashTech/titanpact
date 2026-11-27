import ReactDOM from 'react-dom/client';
import '../../../src/app/styles.css';
import '../../../src/app/storybook.css';
import { FightScreen } from '../../../src/view/combat/FightScreen';
import { LocationProvider } from '../../../src/view/shared/LocationContext';
import { locations } from '../../../src/data/locations';
import { allCombatants } from '../../../src/data/content';
import { progressionTable } from '../../../src/data/progression';
import { buildSandboxSide, createSandboxHeroConfig, type SandboxSideConfig } from '../../../src/run/sandbox';

// ?redraw=1 swaps in the redrawn sprites in this folder (<heroId>.png) wherever the fight draws that hero's art.
const REDRAWN: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./*.png', { eager: true, query: '?url', import: 'default' })).map(([p, u]) => [p.slice(2, -4).toLowerCase(), u])
);
if (new URLSearchParams(location.search).get('redraw')) {
  const swap = (img: HTMLImageElement) => {
    const m = /\/heroes\/(?:[a-z]+\/)?([A-Za-z]+?)(attack|damaged)?\.png/.exec(decodeURIComponent(img.src));
    const url = m && REDRAWN[m[1].toLowerCase()];
    if (url && img.src !== new URL(url, location.href).href) img.src = url;
  };
  new MutationObserver(() => document.querySelectorAll('img').forEach(swap)).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
}

// ?loc=<locationId>&p=valor,crag,kitsu&e=ursa,kong — a real FightScreen in one Location, for art review.
const q = new URLSearchParams(location.search);
const loc = q.get('loc') ?? 'wildsEdge';
const ids = (key: string, fallback: string) => (q.get(key) ?? fallback).split(',');

function side(list: string[]): SandboxSideConfig {
  const heroes = list.map((id) => ({ ...createSandboxHeroConfig(id, allCombatants[id]), level: 12 }));
  return { heroes, activeIds: [heroes[0].rosterId, heroes[1]?.rosterId ?? null], relicIds: [] };
}

const player = buildSandboxSide(side(ids('p', 'valor,crag,kitsu')), allCombatants, progressionTable);
const ai = buildSandboxSide(side(ids('e', 'ursa,kong')), allCombatants, progressionTable);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <LocationProvider location={locations[loc] ?? null}>
    <div className="frame">
      <div className="app-shell" style={{ position: 'relative', width: 394, height: 780, left: 0, transform: 'scale(1)' }}>
        <FightScreen playerRun={player.run} playerSquad={player.squad} aiRun={ai.run} aiSquad={ai.squad} goldReward={0} xpGained={0} equipmentReward={null} onResolved={() => {}} />
      </div>
    </div>
  </LocationProvider>
);
