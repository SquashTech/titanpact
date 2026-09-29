import { useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from './reducedMotion';

/** Gold counts up at one strike a step until it has to stride. */
const COIN_TICK_MS = 50;
const COIN_MAX_TICKS = 12;

/** Runs 0 up to `amount` once `active`, one coin-strike a step and the purse's close at the end. */
export function useCoinCount(amount: number, active: boolean): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? amount : 0));

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setShown(amount);
      return;
    }
    const steps = Math.max(1, Math.min(COIN_MAX_TICKS, amount));
    let step = 0;
    const interval = window.setInterval(() => {
      step += 1;
      setShown(Math.round((amount * step) / steps));
      playSfx('gold.coin', { pitch: 1 + step * 0.04 });
      if (step >= steps) {
        window.clearInterval(interval);
        playSfx('gold.purse', { delay: 0.05 });
      }
    }, COIN_TICK_MS);
    return () => window.clearInterval(interval);
  }, [amount, active]);

  return active ? shown : 0;
}
