import type { ReactNode } from 'react';

/** A gold keyword heading a line, as passives and moves read: `Cost: 20 gold`. */
export function Keyed({ word, children }: { word: string; children: ReactNode }) {
  return (
    <>
      <span className="kw-badge">{word}</span> {children}
    </>
  );
}
