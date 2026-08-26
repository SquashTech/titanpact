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
 * Reports *layout viewport* px plus the page zoom relating them to device px.
 *
 * These are only the same number at zoom 1. A browser rendering the page at
 * zoom z hands out a layout viewport 1/z times the device's own size, so an
 * iPhone reporting `screen 390x844` reports `innerWidth 780` at zoom 0.5 — and
 * every measurement here inflates to match. Nothing errors; the layout just
 * silently comes out half size. Reported once from a real installed build
 * (2026-08-26) and the reason `layout()` below works in device px throughout.
 *
 * Page zoom is a per-site browser setting, not something the page controls: it
 * survives reinstalling a home-screen web app, does not appear under Safari's
 * Website Data, and is set independently in every browser. It cannot be
 * prevented from here (iOS has ignored `user-scalable=no` since iOS 10, for
 * accessibility reasons), so it has to be measured and compensated for.
 */
function viewportMetrics(): { vw: number; vh: number; zoom: number } {
  const vv = window.visualViewport;
  if (!vv) return { vw: window.innerWidth, vh: window.innerHeight, zoom: 1 };
  return { vw: vv.width, vh: vv.height, zoom: vv.scale > 0 ? vv.scale : 1 };
}

function layout(shell: HTMLElement): void {
  const { vw, vh, zoom } = viewportMetrics();

  // Everything below is in device px — what the viewport would measure at zoom
  // 1 — so the design canvas is chosen from the screen the player is actually
  // holding rather than from a zoom-inflated one. At zoom 1 this is identity
  // and the arithmetic is exactly what it was before.
  const deviceWidth = vw * zoom;
  const deviceHeight = vh * zoom;

  const footprintWidth = Math.min(deviceWidth, MAX_WIDTH);
  const rawScale = Math.min(footprintWidth / REFERENCE_WIDTH, deviceHeight / REFERENCE_HEIGHT);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

  // Back to layout px, which is the unit the styles are interpreted in. The
  // transform carries the extra 1/zoom so the shell still covers the whole
  // screen: at zoom 0.5 a 390px-wide canvas is drawn at 780 layout px, which
  // the browser then renders back down to the 390pt the device really has.
  shell.style.width = `${footprintWidth / scale}px`;
  shell.style.height = `${deviceHeight / scale}px`;
  shell.style.left = `${(vw - footprintWidth / zoom) / 2}px`;
  shell.style.transform = `scale(${scale / zoom})`;
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
