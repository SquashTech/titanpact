// The Threshold's fights, the Herald's and the Eyes' (docs/titan-eyes.md §13): the arena IS the
// Titan, a floor of its cracked plates lit magenta, curving away into fog. The heartbeat is the
// only motion (styles.css .titan-body::after).

import { memo } from 'react';
import { locationBackdrop } from '../shared/locationBackdrops';
import { FINALE_LOCATION_ID } from '../../data/locations';

export const TitanBody = memo(function TitanBody() {
  const painting = locationBackdrop(FINALE_LOCATION_ID, 'battle');
  return (
    <div className="titan-body" aria-hidden="true">
      {painting && <img className="titan-body-hide" src={painting} alt="" draggable={false} />}
    </div>
  );
});
