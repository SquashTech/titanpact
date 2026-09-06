import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import {
  normalizeLine,
  parseTutorialText,
  type TutorialBeat,
  type TutorialIconToken,
  type TutorialSpeaker,
} from '../../run/tutorial';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { MoveKindGlyph } from '../shared/statIcons';
import { overlayHost } from '../shared/overlayHost';

/** Who each speaker is on the roster. The pair is forced for the scripted run (run/tutorial.ts). */
const SPEAKER_HERO_ID: Record<TutorialSpeaker, string> = {
  valor: 'valor',
  fang: 'packAlpha',
};

/**
 * Which badge class an inline token wears — the same ones the move grid uses (`MoveKindBadge`),
 * so the mark in the dialogue is literally the mark on the button the player is being sent to.
 */
const TOKEN_BADGE_CLASS: Record<TutorialIconToken, string> = {
  physical: 'category-physical',
  magical: 'category-magical',
  heal: 'kind-heal',
  buff: 'kind-buff',
  debuff: 'kind-debuff',
};

/** One line, with `[physical]`-style tokens swapped for the glyph they name. */
function TutorialText({ text }: { text: string }) {
  return (
    <>
      {parseTutorialText(text).map((segment, i) =>
        'icon' in segment ? (
          <span key={i} className={`category-badge move-kind-badge tutorial-inline-icon ${TOKEN_BADGE_CLASS[segment.icon]}`}>
            <MoveKindGlyph kind={segment.icon} className="move-kind-glyph" />
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  );
}

interface Props {
  beat: TutorialBeat;
  /** Fired once, when the last line is dismissed. */
  onDone: () => void;
}

/**
 * Valor talking the player through the scripted first run (docs/tutorial.md). Docked at the
 * bottom over whatever screen is being explained, so the thing she is naming stays visible —
 * the scrim dims and blocks input, deliberately without the blur the modal panels use.
 *
 * Portalled through overlayHost, never document.body: the shell is the transform-scaled design
 * canvas (the standing rule in overlayHost.ts).
 */
export function TutorialOverlay({ beat, onDone }: Props) {
  const [step, setStep] = useState(0);

  // Clamped rather than trusted: taps land faster than React commits, and an unclamped counter
  // walks off the end of the script and renders a speaker saying nothing. Both `onDone` paths
  // are idempotent, so the extra taps at the end are harmless once the line itself is pinned.
  const index = Math.min(step, beat.lines.length - 1);
  const line = normalizeLine(beat.lines[index]);
  const hero = heroes[SPEAKER_HERO_ID[line.speaker]];
  const last = index >= beat.lines.length - 1;

  function advance() {
    if (last) {
      playSfx('ui.confirm');
      onDone();
      return;
    }
    playSfx('ui.tap');
    setStep((i) => i + 1);
  }

  return createPortal(
    <div className="tutorial-overlay" onClick={advance} role="dialog" aria-live="polite">
      <div
        className="tutorial-box"
        style={{ '--speaker-rgb': getTypeColorRgb(hero?.types[0] ?? 'Iron') } as CSSProperties}
      >
        <div className="tutorial-portrait">
          {/* Keyed on the speaker so handing a line to Fang replays the arrival rather than cross-fading a face. */}
          <HeroPortrait key={line.speaker} heroId={SPEAKER_HERO_ID[line.speaker]} className="tutorial-portrait-art" />
        </div>

        <div className="tutorial-body">
          <div className="tutorial-name-row">
            <span className="tutorial-name">{hero?.name ?? 'Valor'}</span>
            {beat.topic && <span className="tutorial-topic">{beat.topic}</span>}
          </div>

          {/* Keyed on the line index so each line re-runs its own type-in. */}
          <p className="tutorial-line" key={index}>
            <TutorialText text={line.text} />
          </p>

          <div className="tutorial-foot">
            <div className="tutorial-pips" aria-label={`Line ${index + 1} of ${beat.lines.length}`}>
              {beat.lines.map((_, i) => (
                <span key={i} className={`tutorial-pip${i === index ? ' is-current' : ''}${i < index ? ' is-done' : ''}`} />
              ))}
            </div>
            <span className="tutorial-advance">{last ? 'Tap to continue' : 'Tap'}</span>
          </div>
        </div>
      </div>
    </div>,
    overlayHost()
  );
}
