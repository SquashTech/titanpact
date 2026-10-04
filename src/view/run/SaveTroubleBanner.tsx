import { HubGlyph } from '../shared/nodeIcons';

/**
 * A save that did not land whole, said once over whatever screen is up (docs/save-system.md §8).
 * It never blocks play: the run goes on in memory and every later screen tries the write again.
 */
export function SaveTroubleBanner({ line, onDismiss }: { line: string; onDismiss: () => void }) {
  return (
    <button type="button" className="save-trouble-banner" role="status" onClick={onDismiss}>
      <HubGlyph name="warn" className="save-trouble-glyph" />
      <span>
        {line} <span className="save-trouble-dismiss">Tap to dismiss.</span>
      </span>
    </button>
  );
}
