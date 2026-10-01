import type { ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { HubGlyph } from '../shared/nodeIcons';

/** A hub page's title bar: its name, and the stars to spend at the far end. */
export function HubPageHead({ title, balance, children }: { title: string; balance?: number; children?: ReactNode }) {
  return (
    <header className="hub-head">
      <span className="hub-head-title">{title}</span>
      {children}
      {balance !== undefined && (
        <span className="hub-head-balance" aria-label={`${balance} ${balance === 1 ? 'star' : 'stars'}`}>
          <HubGlyph name="star" />
          {balance}
        </span>
      )}
    </header>
  );
}

export interface SubtabSpec<Id extends string> {
  id: Id;
  label: string;
  count?: number;
}

/** The page's own sections, along its top — the bottom bar is where the places are. */
export function HubSubtabs<Id extends string>({ tabs, active, onSelect }: { tabs: readonly SubtabSpec<Id>[]; active: Id; onSelect: (id: Id) => void }) {
  return (
    <div className="hub-subtabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          data-sfx="none"
          className={`hub-subtab${tab.id === active ? ' is-active' : ''}`}
          onClick={() => {
            if (tab.id === active) return;
            playSfx('ui.page');
            onSelect(tab.id);
          }}
        >
          {tab.label}
          {tab.count != null && <span className="hub-subtab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
