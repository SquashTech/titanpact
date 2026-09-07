import { playSfx } from '../../audio/sfx';
import { SectionGlyph, type SectionGlyphName } from './sectionIcons';

export interface TabSpec<Id extends string> {
  id: Id;
  label: string;
  glyph: SectionGlyphName;
  /** How many things this page holds. `0` greys the tab; omit where a count means nothing. */
  count?: number;
}

/**
 * The segmented control at the top of a tabbed sheet. Stops propagation on every tap: a tabbed
 * panel is a place the player dwells in, and the sheets that host one sit inside overlays whose
 * backdrops dismiss on click.
 *
 * The `count` is what makes a tab worth not opening — an empty Passives page is a fact the player
 * can read off the strip instead of paying a tap to discover.
 */
export function TabStrip<Id extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly TabSpec<Id>[];
  active: Id;
  onSelect: (id: Id) => void;
}) {
  return (
    <div className="tab-strip" role="tablist" onClick={(e) => e.stopPropagation()}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab-button${isActive ? ' is-active' : ''}${tab.count === 0 ? ' is-empty' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isActive) return;
              playSfx('ui.page');
              onSelect(tab.id);
            }}
          >
            <SectionGlyph name={tab.glyph} />
            <span className="tab-button-label">{tab.label}</span>
            {tab.count != null && tab.count > 0 && <span className="tab-button-count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
