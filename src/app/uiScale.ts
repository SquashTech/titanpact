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
 *
 * The width ratio measures the *footprint* (viewport width capped at
 * MAX_WIDTH), not the raw viewport. Past 430px of screen the extra width
 * is unused, so feeding it in would keep inflating scale — and because
 * canvas width is footprint/scale, inflating scale makes the authored
 * canvas *narrower*. Capping first is what makes canvas width a stable
 * `min(footprint, REFERENCE_WIDTH)` instead of a function of the screen.
 *
 * REFERENCE_WIDTH was 340 until 2026-08-26, which no viewport could ever
 * reach: at 340, a 412px phone wants scale 1.21 and pins to MAX_SCALE,
 * yielding a 343px canvas. That never showed up in a browser tab, because
 * the address bar keeps the viewport short enough that the *height* ratio
 * always bound first and held scale near 1.0 — so the effective canvas was
 * ~394px and the enlargement this module exists to do was switched off in
 * practice. Installing the app as a PWA removed the address bar, the width
 * ratio started binding, and the layout silently reshaped to a narrower,
 * taller canvas. 394 is the width the UI has actually been designed and
 * played against; setting it here makes that explicit and keeps a tab and
 * an installed launch identical, differing only in vertical room.
 */
const REFERENCE_WIDTH = 394;
const REFERENCE_HEIGHT = 700;
const MAX_WIDTH = 430;
const MIN_SCALE = 1;
/* Now a backstop rather than a live constraint: footprint is capped at
   MAX_WIDTH, so the width ratio cannot exceed 430/394 ≈ 1.09. */
const MAX_SCALE = 1.2;

/**
 * Both branches report *layout viewport* px, which equal device px only at
 * zoom 1. If the page is ever zoomed, every number here inflates by 1/zoom and
 * the whole layout silently renders at the wrong size without erroring — see
 * the minimum-scale note on index.html's viewport meta, which is what keeps
 * that from happening. `visualViewport.scale` is the value to check first if
 * this module ever appears to be measuring a viewport the device doesn't have.
 */
function viewportSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  return vv ? { width: vv.width, height: vv.height } : { width: window.innerWidth, height: window.innerHeight };
}

function layout(shell: HTMLElement): void {
  const { width: vw, height: vh } = viewportSize();
  const footprintWidth = Math.min(vw, MAX_WIDTH);
  const rawScale = Math.min(footprintWidth / REFERENCE_WIDTH, vh / REFERENCE_HEIGHT);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

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
