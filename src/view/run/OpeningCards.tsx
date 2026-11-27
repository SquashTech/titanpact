import { useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import type { SfxId } from '../../audio/sounds';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { OPENING_CARDS, type OpeningPicture } from '../../data/opening';
import worldArt from '../../../art/title/opening/world.png';
import collectorArt from '../../../art/title/opening/collector.png';
import trappedArt from '../../../art/title/opening/trapped.png';
import guardArt from '../../../art/title/opening/guard.png';
import lastPageArt from '../../../art/title/opening/lastPage.png';
import freeArt from '../../../art/title/opening/free.png';
import inkmaster from '../../../art/title/opening/inkmaster.png';
import cinder from '../../../art/heroes/cinder.png';
import gallant from '../../../art/heroes/gallant.png';
import pixie from '../../../art/heroes/pixie.png';
import ursa from '../../../art/heroes/ursa.png';
import manticore from '../../../art/heroes/guardians/manticore.png';
import './openingCards.css';

// The opening (docs/worlds.md §3.8): six lines, each under a storybook picture, turned like pages.
// It plays on its own; a tap moves to the next card sooner.

const LEAD_MS = 500;
const BASE_MS = 2600;
const PER_CHAR_MS = 55;
const LAST_HOLD_MS = 1600;

const HEROES = [cinder, gallant, pixie, ursa];

const PAINTING: Record<OpeningPicture, string> = {
  world: worldArt,
  collector: collectorArt,
  trapped: trappedArt,
  guard: guardArt,
  lastPage: lastPageArt,
  free: freeArt,
};

/** Who stands in each picture, and where (`figures` modifier class). */
const FIGURES: Partial<Record<OpeningPicture, readonly string[]>> = {
  world: HEROES,
  collector: [inkmaster],
  trapped: HEROES.slice(0, 3),
  guard: [manticore],
  free: HEROES,
};

const SOUND: Partial<Record<OpeningPicture, SfxId>> = { trapped: 'quill.scratch', lastPage: 'ui.page' };

/** One storybook picture and whoever stands in it; the Cycle lore cards turn the same pages. */
export function OpeningPictureFrame({ picture }: { picture: OpeningPicture }) {
  return (
    <div className="opening-card-picture" aria-hidden="true">
      <img className="opening-painting" src={PAINTING[picture]} alt="" draggable={false} />
      {FIGURES[picture] && (
        <div className="opening-figures">
          {FIGURES[picture]!.map((src, n) => (
            <img key={src} src={src} alt="" draggable={false} style={{ ['--i' as string]: n }} />
          ))}
        </div>
      )}
    </div>
  );
}

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
    if (at < 0) return;
    playSfx(SOUND[OPENING_CARDS[at].picture] ?? 'ui.tab', { gain: 0.7 });
  }, [at]);

  const next = () => {
    if (at < last) setAt(at + 1);
  };

  return (
    <div className={`opening-cards${still ? ' is-still' : ''}`} onClick={next}>
      {OPENING_CARDS.map((card, i) => (
        <div
          key={card.picture}
          className={`opening-card is-${card.picture}${i === at ? ' is-on' : ''}${i < at ? ' is-past' : ''}`}
          style={{ ['--card-ms' as string]: `${cardMs(i) + 1200}ms` }}
          aria-hidden={i !== at}
        >
          <OpeningPictureFrame picture={card.picture} />
          <p className="opening-card-line">{card.line}</p>
        </div>
      ))}
    </div>
  );
}
