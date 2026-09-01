// Scales the app shell as a fixed-size design canvas (~394px wide) transform-scaled to fill the
// device viewport. JS-measured px + `transform: scale()` on purpose: CSS `zoom` + dvh/vw measured
// inconsistently across real mobile webviews. Scale is min(width ratio, height ratio) so short
// viewports don't gain overflow; REFERENCE_HEIGHT sits well below phone heights so it rarely binds.
// The width ratio uses the footprint (capped at MAX_WIDTH), not the raw viewport — otherwise a wide
// screen inflates scale and *narrows* the canvas.

const REFERENCE_WIDTH = 394;
const REFERENCE_HEIGHT = 700;
const MAX_WIDTH = 430;
const MIN_SCALE = 1;
// Backstop only: the capped footprint keeps the width ratio ≤ 430/394 ≈ 1.09.
const MAX_SCALE = 1.2;

// Layout viewport px plus the page zoom relating them to device px. At zoom 0.5 an iPhone with
// `screen 390x844` reports `innerWidth 780`; page zoom is a per-site browser setting the page can't
// prevent, so it is measured and compensated for — `layout()` works in device px throughout.
function viewportMetrics(): { vw: number; vh: number; zoom: number } {
  const vv = window.visualViewport;
  if (!vv) return { vw: window.innerWidth, vh: window.innerHeight, zoom: 1 };
  return { vw: vv.width, vh: vv.height, zoom: vv.scale > 0 ? vv.scale : 1 };
}

function layout(shell: HTMLElement): void {
  const { vw, vh, zoom } = viewportMetrics();

  const deviceWidth = vw * zoom;
  const deviceHeight = vh * zoom;

  const footprintWidth = Math.min(deviceWidth, MAX_WIDTH);
  const rawScale = Math.min(footprintWidth / REFERENCE_WIDTH, deviceHeight / REFERENCE_HEIGHT);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

  // Back to layout px; the transform carries the extra 1/zoom so the shell still covers the screen.
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
