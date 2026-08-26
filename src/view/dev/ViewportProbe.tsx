import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * TEMPORARY diagnostic readout — delete once the installed-PWA layout issue is
 * closed out. Reports the numbers that decide what `uiScale.ts` does, because
 * they cannot be reproduced off-device: an installed iOS/Android web app can
 * report a different layout viewport than the same URL in a browser tab, and a
 * screenshot alone can't distinguish the causes.
 *
 * Portalled to <body> rather than rendered in place: `.app-shell` carries a
 * `transform`, and a transformed ancestor becomes the containing block for
 * `position: fixed` descendants — so a probe rendered inside the shell would be
 * positioned and scaled by the very thing it is trying to measure.
 */
function readSample() {
  const vv = window.visualViewport;
  const shell = document.querySelector('.app-shell') as HTMLElement | null;
  const mode = ['standalone', 'fullscreen', 'minimal-ui', 'browser'].find((m) => window.matchMedia(`(display-mode: ${m})`).matches);
  return {
    mode: mode ?? '?',
    standaloneIOS: (navigator as { standalone?: boolean }).standalone ?? '-',
    inner: `${window.innerWidth}x${window.innerHeight}`,
    visual: vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} @${vv.scale}` : '-',
    docEl: `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    dpr: window.devicePixelRatio,
    shell: shell ? `${Math.round(parseFloat(shell.style.width))}x${Math.round(parseFloat(shell.style.height))} ${shell.style.transform} left:${shell.style.left}` : '-',
    viewportMeta: document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? 'MISSING',
  };
}

export function ViewportProbe() {
  const [sample, setSample] = useState(readSample);

  useEffect(() => {
    const update = () => setSample(readSample());
    update();
    const id = window.setInterval(update, 500);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 99999,
        background: 'rgba(0,0,0,0.88)',
        color: '#5cff9d',
        font: '600 15px/1.45 ui-monospace, Menlo, Consolas, monospace',
        padding: '8px 10px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        pointerEvents: 'none',
        borderBottom: '2px solid #5cff9d',
      }}
    >
      {Object.entries(sample)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')}
    </div>,
    document.body
  );
}
