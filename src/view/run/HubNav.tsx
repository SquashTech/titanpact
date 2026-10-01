import { playSfx } from '../../audio/sfx';
import collectionArt from '../../../art/ui/collection.png';
import constellationArt from '../../../art/ui/constellation.png';
import playArt from '../../../art/ui/play.png';

export type HubTab = 'collection' | 'play' | 'constellation';

/** Left to right; the order the pages slide in. */
export const HUB_TABS: readonly HubTab[] = ['collection', 'play', 'constellation'];

interface Props {
  tab: HubTab;
  onSelect: (tab: HubTab) => void;
  /** Stars to spend, worn on the Constellation's tab. */
  balance: number;
  /** Something new waits in the Collection (a hero just fallen). */
  collectionFresh: boolean;
  disabled?: boolean;
}

/**
 * The title hub's bottom bar (Clash Royale / Marvel Snap): the Collection and the Constellation
 * either side of Play, which is raised out of the bar as the seal it leaves through.
 */
export function HubNav({ tab, onSelect, balance, collectionFresh, disabled }: Props) {
  function select(next: HubTab) {
    if (next === tab || disabled) return;
    playSfx('ui.tab');
    onSelect(next);
  }

  return (
    <nav className="hub-nav" role="tablist" aria-label="Main">
      <button type="button" role="tab" aria-selected={tab === 'collection'} data-sfx="none" className={`hub-nav-tab${tab === 'collection' ? ' is-active' : ''}`} onClick={() => select('collection')}>
        <span className="hub-nav-light" aria-hidden="true" />
        <img src={collectionArt} className="hub-nav-icon" alt="" draggable={false} />
        <span className="hub-nav-label">Collection</span>
        {collectionFresh && <span className="hub-nav-fresh" aria-label="New hero" />}
      </button>

      <button type="button" role="tab" aria-selected={tab === 'play'} data-sfx="none" className={`hub-nav-play${tab === 'play' ? ' is-active' : ''}`} onClick={() => select('play')}>
        <span className="hub-nav-play-ring" aria-hidden="true" />
        <span className="hub-nav-play-face">
          <img src={playArt} className="hub-nav-play-icon" alt="" draggable={false} />
        </span>
        <span className="hub-nav-label">Play</span>
      </button>

      <button type="button" role="tab" aria-selected={tab === 'constellation'} data-sfx="none" className={`hub-nav-tab is-sky${tab === 'constellation' ? ' is-active' : ''}`} onClick={() => select('constellation')}>
        <span className="hub-nav-light" aria-hidden="true" />
        <img src={constellationArt} className="hub-nav-icon" alt="" draggable={false} />
        <span className="hub-nav-label">Constellation</span>
        <span className={`hub-nav-badge${balance > 0 ? ' is-lit' : ''}`}>★ {balance}</span>
      </button>
    </nav>
  );
}
