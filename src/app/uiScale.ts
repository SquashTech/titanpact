/**
 * Sets --ui-scale (consumed by .app-shell in styles.css) so the fixed-px UI,
 * authored against a ~340px canvas, is zoomed up to fill real phone widths
 * (360-430px CSS px) instead of rendering at its small authored size.
 */
const REFERENCE_WIDTH = 340;
const MIN_SCALE = 1;
const MAX_SCALE = 1.3;

function computeScale(): number {
  const width = document.documentElement.clientWidth;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, width / REFERENCE_WIDTH));
}

function applyUiScale(): void {
  document.documentElement.style.setProperty('--ui-scale', String(computeScale()));
}

export function initUiScale(): void {
  applyUiScale();
  window.addEventListener('resize', applyUiScale);
  window.addEventListener('orientationchange', applyUiScale);
}
