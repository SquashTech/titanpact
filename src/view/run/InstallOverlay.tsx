import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { canPromptInstall, onInstallPromptChange, promptInstall } from '../../app/installPrompt';
import { INSTALL_CARD } from '../../data/tips';
import type { InstallPlatform } from '../../run/installHint';
import { overlayHost } from '../shared/overlayHost';

/** iOS's Share mark: a box with an arrow out of its top. */
function ShareGlyph() {
  return (
    <svg className="install-glyph" viewBox="0 0 16 16" width="14" height="14" aria-label="Share">
      <path d="M8 1v9M4.5 4.5 8 1l3.5 3.5M5 7H3v8h10V7h-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A step with `[share]` / `[menu]` swapped for the mark the player is looking for. */
function StepText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[share\]|\[menu\])/).map((part, i) =>
        part === '[share]' ? (
          <ShareGlyph key={i} />
        ) : part === '[menu]' ? (
          <span key={i} className="install-glyph install-menu-glyph" aria-label="Menu">
            ⋮
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface Props {
  platform: InstallPlatform;
  /** Fired once, on either button: the card is a once-an-account note, not a nag. */
  onDone: () => void;
}

/**
 * The first-launch install card, over the title. On Android the browser's own install dialog is
 * one tap when it has offered one (`beforeinstallprompt`); everywhere else the card can only say
 * where to tap. Portalled through overlayHost, never document.body.
 */
export function InstallOverlay({ platform, onDone }: Props) {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall);
  useEffect(() => onInstallPromptChange(() => setCanPrompt(canPromptInstall())), []);

  const card = INSTALL_CARD[platform];
  const oneTap = platform === 'android' && canPrompt;

  async function handleInstall() {
    playSfx('ui.confirm');
    await promptInstall();
    onDone();
  }

  function handleDismiss() {
    playSfx('ui.tap');
    onDone();
  }

  return createPortal(
    <div className="tip-overlay install-overlay" role="dialog" aria-live="polite">
      <div className="tip-box install-box">
        <h2 className="install-title">{card.title}</h2>
        <p className="tip-page">{card.lead}</p>
        {!oneTap && (
          <ol className="install-steps">
            {card.steps.map((step, i) => (
              <li key={i}>
                <StepText text={step} />
              </li>
            ))}
          </ol>
        )}
        {card.note && <p className="install-note">{card.note}</p>}
        <div className="install-actions">
          {oneTap ? (
            <>
              <button className="secondary-button" data-sfx="none" onClick={handleDismiss}>
                Not now
              </button>
              <button className="resolve-button" data-sfx="none" onClick={handleInstall}>
                Install
              </button>
            </>
          ) : (
            <button className="resolve-button" data-sfx="none" onClick={handleDismiss}>
              Got it
            </button>
          )}
        </div>
      </div>
    </div>,
    overlayHost()
  );
}
