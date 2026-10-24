/**
 * The title's one press: a chamfered plate of night sky, rimmed in its colour. It carries no colour of
 * its own: the metal is a set of custom properties declared on `.title-screen`'s tone.
 */
export function PactButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="title-cta-socket">
      <span className="title-cta-wing-tip is-left" aria-hidden="true" />
      <span className="title-cta-wing-tip is-right" aria-hidden="true" />
      <span className="title-cta-frame" aria-hidden="true" />
      <button className="resolve-button title-cta" onClick={onClick} disabled={disabled}>
        <span className="title-cta-label">{label}</span>
      </button>
    </div>
  );
}
