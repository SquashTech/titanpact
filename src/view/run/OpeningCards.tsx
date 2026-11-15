import { useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import type { SfxId } from '../../audio/sounds';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { OPENING_CARDS, type OpeningPicture } from '../../data/opening';
import panelFall from '../../../art/title/opening/panelFall.png';
import panelImpact from '../../../art/title/opening/panelImpact.png';
import ridgePainting from '../../../art/title/openingRidge.png';
import manticore from '../../../art/heroes/guardians/manticore.png';
import kraken from '../../../art/heroes/guardians/kraken.png';
import dragon from '../../../art/heroes/guardians/dragon.png';
import skeletonKing from '../../../art/heroes/guardians/skeletonKing.png';
import leftEye from '../../../art/heroes/titan/eye.png';
import leftEyeClosed from '../../../art/heroes/titan/eyeclosed.png';
import rightEye from '../../../art/heroes/titan/righteye.png';
import rightEyeClosed from '../../../art/heroes/titan/righteyeclosed.png';
import './openingCards.css';

// The opening (docs/the-sky.md §1): six lines, each over a slow ambient picture. It plays on its own;
// a tap moves to the next card sooner.

const LEAD_MS = 500;
const BASE_MS = 2600;
const PER_CHAR_MS = 55;
const LAST_HOLD_MS = 1600;

const GUARDIANS = [manticore, kraken, dragon, skeletonKing];
const SOUND: Partial<Record<OpeningPicture, SfxId>> = { fall: 'entrance.dread', failing: 'seal.shatter', eyes: 'titan.stir' };

const cardMs = (i: number) => BASE_MS + OPENING_CARDS[i].line.length * PER_CHAR_MS;

export function OpeningCards({ onSettled }: { onSettled: () => void }) {
  const still = prefersReducedMotion();
  const [at, setAt] = useState(-1);
  const last = OPENING_CARDS.length - 1;

  useEffect(() => {
    const timer = window.setTimeout(
      () => (at < last ? setAt(at + 1) : onSettled()),
      at < 0 ? LEAD_MS : at < last ? cardMs(at) : cardMs(at) + LAST_HOLD_MS
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  useEffect(() => {
    const sound = at >= 0 ? SOUND[OPENING_CARDS[at].picture] : undefined;
    if (sound) playSfx(sound, { gain: 0.7 });
  }, [at]);

  const next = () => {
    if (at < last) setAt(at + 1);
  };

  return (
    <div className={`opening-cards${still ? ' is-still' : ''}`} onClick={next}>
      {OPENING_CARDS.map((card, i) => (
        <div
          key={card.picture}
          className={`opening-card is-${card.picture}${i === at ? ' is-on' : ''}`}
          style={{ ['--card-ms' as string]: `${cardMs(i) + 1200}ms` }}
          aria-hidden={i !== at}
        >
          <div className="opening-card-picture" aria-hidden="true">
            <Picture of={card.picture} />
          </div>
          <p className="opening-card-line">{card.line}</p>
        </div>
      ))}
    </div>
  );
}

function Picture({ of }: { of: OpeningPicture }) {
  switch (of) {
    case 'fall':
      return <img className="opening-band" src={panelFall} alt="" draggable={false} />;
    case 'sealed':
      return <img className="opening-band" src={panelImpact} alt="" draggable={false} />;
    case 'failing':
      return <img className="opening-band is-tall" src={ridgePainting} alt="" draggable={false} />;
    case 'guardians':
      return (
        <div className="opening-guardians">
          {GUARDIANS.map((src, i) => (
            <img key={src} src={src} alt="" draggable={false} style={{ ['--i' as string]: i }} />
          ))}
        </div>
      );
    case 'eyes':
      return (
        <div className="opening-eyes">
          {[
            [leftEyeClosed, leftEye],
            [rightEyeClosed, rightEye],
          ].map(([closed, open]) => (
            <span key={open} className="opening-eye">
              <img className="is-closed" src={closed} alt="" draggable={false} />
              <img className="is-open" src={open} alt="" draggable={false} />
            </span>
          ))}
        </div>
      );
    case 'pact':
      return null;
  }
}
