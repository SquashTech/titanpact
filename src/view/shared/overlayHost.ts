/**
 * Where a portalled overlay must be mounted: **inside `.app-shell`**, never on
 * `document.body`.
 *
 * The three combat detail overlays (move, status, Field Effect) each portal out
 * of the component that opens them, for a real reason StatusDetailOverlay
 * documents: they are reached from an icon nested inside a `CombatantCard`, and
 * that card can carry `filter` (fainted/locked) or `transform`
 * (targetable:hover) — either of which turns a `position: fixed` descendant
 * into a containing-block child of the card rather than of the viewport.
 *
 * Portalling to `document.body` fixed that and introduced a worse one, which
 * only shows up on a real device. `.app-shell` is a **transform-scaled design
 * canvas** (src/app/uiScale.ts): every size in this app is authored against a
 * ~394px canvas and the shell is scaled to fill the real screen. Anything
 * mounted outside the shell is not scaled — it renders at its authored px
 * against the raw layout viewport. On a browser at page zoom 0.5, which
 * uiScale.ts records as a real measured case (an iPhone reporting `screen
 * 390x844` hands the page a **780px** layout viewport), a 380px detail card
 * came out at 48% of the screen width — the same card that is 92% of the
 * canvas everywhere else, sitting next to move rows rendered twice its size.
 *
 * The shell is the right host for both problems at once. It always carries a
 * `transform` (`scale(…)`, set inline by uiScale — never `none`), and any
 * transform makes an element the containing block for its `position: fixed`
 * descendants. So `inset: 0` on an overlay means *the canvas*: it is scaled
 * with everything else, and it is still above every card's own filter or
 * transform, which is what the portal was for.
 *
 * Falls back to `document.body` only if the shell is somehow absent — an
 * overlay at the wrong scale beats an overlay that fails to mount.
 */
export function overlayHost(): HTMLElement {
  return (document.querySelector('.app-shell') as HTMLElement | null) ?? document.body;
}
