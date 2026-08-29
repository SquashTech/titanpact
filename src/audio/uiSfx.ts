/**
 * UI click sounds, installed once as a single delegated listener.
 *
 * The app has ~160 click handlers spread over 40-odd screens. Threading a
 * `playSfx` call through every one of them would be 160 edits, 160 chances
 * to forget one, and a permanent tax on every new control. Instead this
 * listens at the document in the capture phase and decides what to play
 * from the element itself — so a control authored tomorrow is audible with
 * no audio code in it at all.
 *
 * Resolution order, walking up from the tapped node:
 *   1. `data-sfx="<id>"`  — an explicit choice. `data-sfx="none"` silences.
 *   2. a class in CLASS_SFX — the handful of controls that want more than a tap.
 *   3. any <button>/[role=button]/<a href>/<summary> — the default tap.
 * Disabled controls (`disabled` or `aria-disabled="true"`, which is how this
 * codebase marks an unaffordable move or an unreachable map node) play the
 * refusal sound instead of whatever they would otherwise have played.
 *
 * Plain <div onClick> handlers are deliberately NOT caught: several of them
 * are full-screen backdrops and the fight screen's beat-advance overlay,
 * which must stay silent. Those opt in with `data-sfx` where they want a
 * sound.
 */

import { playSfx } from './sfx';
import type { SfxId } from './sounds';

/**
 * Controls whose meaning isn't "a generic tap". Matched by class name so
 * the components themselves stay unaware of audio — first match wins.
 */
const CLASS_SFX: readonly (readonly [string, SfxId])[] = [
  ['log-close-button', 'ui.back'],
  ['detail-close-button', 'ui.back'],
  ['exit-button', 'ui.back'],
  ['bottom-action-back', 'ui.back'],
  // The run-shaping commitments — sealing the starter draft, taking a
  // Mentor's class. These carry `resolve-button` too, so they must be
  // matched BEFORE it or the generic confirm wins.
  ['draft-cta', 'ui.commit'],
  ['class-shrine-confirm-button', 'ui.commit'],
  // The commit buttons: locking in a round, claiming a reward, buying.
  ['resolve-button', 'ui.confirm'],
  ['replacement-confirm-button', 'ui.confirm'],
  ['relic-shrine-claim-button', 'ui.confirm'],
  ['moveoffer-button', 'ui.confirm'],
  // Choosing without committing.
  ['move-button', 'ui.select'],
  ['map-node', 'ui.confirm'],
];

const CLICKABLE = 'button, [role="button"], a[href], summary, input[type="checkbox"], input[type="radio"]';

/** How far up the tree to look before giving up — deep enough for an icon inside a span inside a button. */
const MAX_DEPTH = 6;

function isDisabled(el: Element): boolean {
  if (el.getAttribute('aria-disabled') === 'true') return true;
  return 'disabled' in el && (el as HTMLButtonElement).disabled === true;
}

/**
 * The rule above, as a function. Exported so the mapping can be checked
 * against real rendered markup ("what does this actual button play?")
 * rather than inferred from the class list by eye.
 */
export function resolveSfx(target: Element | null): SfxId | null {
  let el: Element | null = target;
  for (let depth = 0; el && depth < MAX_DEPTH; depth++, el = el.parentElement) {
    const explicit = el.getAttribute('data-sfx');
    if (explicit) {
      if (explicit === 'none') return null;
      if (isDisabled(el)) return 'ui.denied';
      return explicit as SfxId;
    }

    for (const [cls, id] of CLASS_SFX) {
      if (el.classList.contains(cls)) return isDisabled(el) ? 'ui.denied' : id;
    }

    if (el.matches(CLICKABLE)) return isDisabled(el) ? 'ui.denied' : 'ui.tap';
  }
  return null;
}

let installed = false;

export function installUiSfx(): void {
  if (installed) return;
  installed = true;

  // pointerdown, not click: the sound should land when the finger lands.
  // Waiting for click puts the feedback after the press has already
  // completed, which reads as lag even at a few tens of milliseconds.
  document.addEventListener(
    'pointerdown',
    (event) => {
      // Secondary buttons don't drive this UI; only the primary press speaks.
      if (event.button !== 0) return;
      const id = resolveSfx(event.target as Element | null);
      if (id) playSfx(id);
    },
    { capture: true }
  );
}
