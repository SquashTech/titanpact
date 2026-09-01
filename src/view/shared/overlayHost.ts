// Standing rule: never `createPortal(…, document.body)` — mount overlays here, inside `.app-shell`.
// The shell is the transform-scaled design canvas (uiScale.ts); anything outside it renders at raw
// authored px against the zoom-inflated layout viewport (a 380px card at 48% width at page zoom 0.5).
// The shell's transform also makes it the containing block for `position: fixed`, so `inset: 0` = the canvas.
export function overlayHost(): HTMLElement {
  return (document.querySelector('.app-shell') as HTMLElement | null) ?? document.body;
}
