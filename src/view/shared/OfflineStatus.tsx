import { useEffect, useState } from 'react';
import { offlineProgress, onOfflineProgress, requestOfflineStatus } from '../../app/registerServiceWorker';

// Whether the whole game is saved on this device, for a menu's .options-list. A tap asks again.
export function OfflineStatus() {
  const [progress, setProgress] = useState(offlineProgress);

  useEffect(() => {
    const off = onOfflineProgress(setProgress);
    requestOfflineStatus();
    return off;
  }, []);

  if (!import.meta.env.PROD) return null;

  const ready = progress !== null && progress.total > 0 && progress.saved >= progress.total;
  const state =
    progress === null || progress.total === 0
      ? 'Checking'
      : ready
        ? 'Ready'
        : `Saving ${Math.floor((progress.saved / progress.total) * 100)}%`;

  return (
    <button className="options-item" onClick={requestOfflineStatus}>
      <span className="options-item-glyph" aria-hidden="true">
        ✈
      </span>
      Offline play
      <span className={`options-item-state${ready ? '' : ' is-off'}`}>{state}</span>
    </button>
  );
}
