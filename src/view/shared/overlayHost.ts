// Standing rule: never `createPortal(…, document.body)` — mount overlays here, inside `.app-shell`.
// The shell is the transform-scaled design canvas (uiScale.ts); anything outside it renders at raw
// authored px against the zoom-inflated layout viewport (a 380px card at 48% width at page zoom 0.5).
// The shell's transform also makes it the containing block for `position: fixed`, so `inset: 0` = the canvas.
export function overlayHost(): HTMLElement {
  return (document.querySelector('.app-shell') as HTMLElement | null) ?? document.body;
}

/**
 * A viewport point (a pointer event's clientX/Y) in the canvas's OWN px. Anything positioned
 * inside the shell is laid out in design px and then scaled with it, so a `left` set straight
 * from clientX lands `scale` times too far from the corner — on a phone, a carried piece drawn
 * that way sat visibly below the thumb, and further below the further down the screen it went.
 */
export function canvasPoint(clientX: number, clientY: number): { x: number; y: number; scale: number } {
  const host = overlayHost();
  const rect = host.getBoundingClientRect();
  const scale = host.offsetWidth > 0 ? rect.width / host.offsetWidth : 1;
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale, scale };
}
