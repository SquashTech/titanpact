/**
 * Positions and scales the app shell as a fixed-size "design canvas"
 * transform-scaled to fill the real device viewport, so fixed-px content
 * (fonts, padding, gaps) authored against a ~340px canvas renders bigger
 * on real phones (360-430px CSS px) instead of at its small authored size.
 *
 * Deliberately JS-measured pixel values + `transform: scale()`, not CSS
 * `zoom` + dvh/vw: that combination measured inconsistently across real
 * mobile browsers/in-app webviews (overflow requiring scroll on one
 * device, no visible enlargement on another) during testing. `transform`
 * has no such viewport-unit reinterpretation ambiguity.
 *
 * The scale is width- AND height-driven (min of both ratios), not just
 * width: a phone with a short/reduced viewport (in-app browser chrome,
 * an older/smaller screen, Safari's toolbar expanded) needs to scale up
 * less than its width alone would suggest, or content that used to fit
 * the fight screen's move/switch panel without scrolling starts needing
 * a scroll it didn't need before. REFERENCE_HEIGHT is deliberately well
 * below typical phone heights (~650-930px) so only genuinely short
 * viewports pull scale back toward 1 (no enlargement, but no new
 * overflow either) — it should rarely be the binding constraint.
 */
const REFERENCE_WIDTH = 340;
const REFERENCE_HEIGHT = 700;
const MAX_WIDTH = 430;
const MIN_SCALE = 1;
const MAX_SCALE = 1.2;

function viewportSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  return vv ? { width: vv.width, height: vv.height } : { width: window.innerWidth, height: window.innerHeight };
}

function layout(shell: HTMLElement): void {
  const { width: vw, height: vh } = viewportSize();
  const rawScale = Math.min(vw / REFERENCE_WIDTH, vh / REFERENCE_HEIGHT);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
  const footprintWidth = Math.min(vw, MAX_WIDTH);

  shell.style.width = `${footprintWidth / scale}px`;
  shell.style.height = `${vh / scale}px`;
  shell.style.left = `${(vw - footprintWidth) / 2}px`;
  shell.style.transform = `scale(${scale})`;
}

/** Call from a mount effect once the app-shell element exists. Returns a cleanup function. */
export function initUiScale(shell: HTMLElement): () => void {
  const relayout = () => layout(shell);
  relayout();
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  window.visualViewport?.addEventListener('resize', relayout);
  return () => {
    window.removeEventListener('resize', relayout);
    window.removeEventListener('orientationchange', relayout);
    window.visualViewport?.removeEventListener('resize', relayout);
  };
}
