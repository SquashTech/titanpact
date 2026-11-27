import ReactDOM from 'react-dom/client';
import type { CSSProperties, ReactNode } from 'react';
import '../../../src/app/styles.css';
import '../../../src/app/storybook.css';
import '../../../src/view/run/mapRoad.css';
import { NODE_COLORS } from '../../../src/view/run/mapNodes';
import type { MapNodeType } from '../../../src/run/map';
import { FLAT_ICONS } from './flatIcons';
import partyArt from '../../../art/ui/party.png';

const TODAY = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../map-nodes/icons/*.png', { eager: true, query: '?url', import: 'default' })).map(([p, u]) => [p.slice(p.lastIndexOf('/') + 1, -4), u])
);
const PIXEL = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./pixel/*.png', { eager: true, query: '?url', import: 'default' })).map(([p, u]) => [p.slice(p.lastIndexOf('/') + 1, -4), u])
);

const ICONS: { id: string; name: string; type: MapNodeType; today: string }[] = [
  { id: 'manaWell', name: 'Mana Well', type: 'manaWellReward', today: 'manaWellReward' },
  { id: 'recruit', name: 'Recruit', type: 'recruitReward', today: 'recruitReward' },
  { id: 'gems', name: 'Gems', type: 'scrollReward', today: 'scrollReward' },
  { id: 'rest', name: 'Rest', type: 'restReward', today: 'restReward' },
  { id: 'item', name: 'Item', type: 'equipmentReward', today: 'equipmentReward' },
  { id: 'boon', name: 'Boon', type: 'passiveReward', today: 'passiveReward' },
  { id: 'elite', name: 'Elite', type: 'elite', today: 'elite' },
  { id: 'skirmish', name: 'Skirmish', type: 'skirmish', today: 'skirmish' },
  { id: 'event', name: 'Event', type: 'event', today: 'event' },
];

type Style = 'today' | 'pixel' | 'flat';
const STYLES: { id: Style; name: string; note: string }[] = [
  { id: 'today', name: 'Today', note: 'The 32px pixel pack, drawn at 1.5×.' },
  { id: 'pixel', name: 'A · Cartoony pixel', note: 'Redrawn at 48px with a chibi hero as the style reference: chunkier shapes, brighter colours, a clean outline. Pixel art like the heroes.' },
  { id: 'flat', name: 'B · Flat drawn', note: 'Drawn as vector shapes with the same ink rim as the buttons and the road. Crisp at any size; no pixels at all.' },
];

function face(style: Style, icon: (typeof ICONS)[number]): ReactNode {
  if (style === 'flat') return <span className="mi-flat">{FLAT_ICONS[icon.id]()}</span>;
  return <img src={style === 'pixel' ? PIXEL[icon.id] : TODAY[icon.today]} alt="" draggable={false} />;
}

function Stop({ style, icon, big }: { style: Style; icon: (typeof ICONS)[number]; big: boolean }) {
  return (
    <span className={`road-stop ${big ? 'is-next' : 'is-done'} mi-stop is-${style}`} style={{ '--node-color': NODE_COLORS[icon.type] } as CSSProperties}>
      <span className="road-disc">{face(style, icon)}</span>
      {big && <span className="road-label">{icon.name}</span>}
    </span>
  );
}

function RosterTab({ style }: { style: Style }) {
  const emblem = style === 'flat' ? <span className="mi-flat mi-emblem">{FLAT_ICONS.roster()}</span> : <img className="mi-emblem" src={style === 'pixel' ? PIXEL.roster : partyArt} alt="" draggable={false} />;
  return (
    <span className="map-screen is-road mi-roster">
      <span className="map-footer-button">
        <span className="map-footer-cap">
          {emblem}
          <span className="map-footer-label">Roster</span>
        </span>
      </span>
    </span>
  );
}

function Page() {
  return (
    <div className="mi-page">
      <h1>Map icons</h1>
      {STYLES.map((s) => (
        <section key={s.id} className="mi-row">
          <h2>{s.name}</h2>
          <p>{s.note}</p>
          <div className="mi-strip">
            <RosterTab style={s.id} />
            {ICONS.map((icon, i) => (
              <Stop key={icon.id} style={s.id} icon={icon} big={i < 3} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Page />);
