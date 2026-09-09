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
// The shortest canvas a screen is authored to survive. Above this the shell simply gets shorter
// and the screens compress, which is the design (see .app-shell); below it they stop compressing
// and start CLIPPING — measured, a fight at 390 canvas px loses the whole command console off the
// bottom. Under this floor the canvas shrinks instead, so a viewport too short for the game is
// small rather than broken. Nothing hits it in portrait; a turned phone hits it every time.
const MIN_CANVAS_HEIGHT = 600;

// Layout viewport px plus the page zoom relating them to device px. At zoom 0.5 an iPhone with
// `screen 390x844` reports `innerWidth 780`; page zoom is a per-site browser setting the page can't
// prevent, so it is measured and compensated for — `layout()` works in device px throughout.
function viewportMetrics(): { vw: number; vh: number; zoom: number } {
  const vv = window.visualViewport;
  if (!vv) return { vw: window.innerWidth, vh: window.innerHeight, zoom: 1 };
  return { vw: vv.width, vh: vv.height, zoom: vv.scale > 0 ? vv.scale : 1 };
}

// Portrait only. The manifest's `orientation: portrait` covers an installed Android PWA and
// nothing else — a browser tab obeys the device, and iOS ignores the manifest entirely. So the
// lock is asked for where the API will grant it, and where it will not the canvas is ROTATED into
// the landscape viewport rather than squashed into it. The game never renders landscape.
function lockPortrait(): void {
  const orientation = window.screen?.orientation as
    | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
    | undefined;
  // Rejects outside fullscreen / an installed app — which is exactly when `rotate` below covers it.
  orientation?.lock?.('portrait').catch(() => {});
}

function layout(shell: HTMLElement): void {
  const { vw, vh, zoom } = viewportMetrics();

  const deviceWidth = vw * zoom;
  const deviceHeight = vh * zoom;

  // ONE layout, whichever way the device is held (2026-09-09, per user direction). A turned
  // phone used to lay the canvas along the screen's SHORT edge and counter-rotate it a quarter
  // turn, so the game stayed upright in the hand. It read as the app fighting the rotation
  // rather than ignoring it — the browser turns the page, then the canvas visibly turns back —
  // and the states it passed through on the way looked broken. `lockPortrait` above still
  // prevents the rotation outright wherever the API will grant it; this is what happens when it
  // will not, and all that happens now is that the same upright canvas gets smaller.
  const footprintWidth = Math.min(deviceWidth, MAX_WIDTH);
  const rawScale = Math.min(footprintWidth / REFERENCE_WIDTH, deviceHeight / REFERENCE_HEIGHT);
  const fitted = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
  // The floor above says "don't shrink, let the screens compress". That is right until the
  // canvas is too short to compress into — see MIN_CANVAS_HEIGHT.
  const scale = Math.min(fitted, deviceHeight / MIN_CANVAS_HEIGHT) || fitted;

  // Design px. The width is capped in the canvas's own units too, or a short viewport would
  // scale down and buy itself a proportionally WIDER canvas out of the same footprint.
  const canvasWidth = Math.min(footprintWidth / scale, MAX_WIDTH);

  // Back to layout px; the transform carries the extra 1/zoom so the shell still covers the screen.
  shell.style.width = `${canvasWidth}px`;
  shell.style.height = `${deviceHeight / scale}px`;
  shell.style.left = `${(vw - (canvasWidth * scale) / zoom) / 2}px`;
  shell.style.transform = `scale(${scale / zoom})`;
}

/** Call from a mount effect once the app-shell element exists. Returns a cleanup function. */
export function initUiScale(shell: HTMLElement): () => void {
  const relayout = () => layout(shell);
  lockPortrait();
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
