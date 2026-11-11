import { rosterHeroes } from '../../data/content';
import type { RunState } from '../../run/state';
import { anyWounded, canBuyMend, mendPrice } from '../../run/wounds';
import { WoundBar, entryHp } from '../shared/WoundBar';
import type { GuildHallOffers } from '../../run/shop';
import { HeroPortrait } from '../shared/HeroPortrait';
import { formIdFor } from '../../run/progression';
import type { TabSpec } from '../shared/TabStrip';
import { GOOD_ART, HALL_ART, HallGood } from './guildHallArt';
import { CONFIRM_PURCHASE_FROM } from '../shared/useArmedTap';
import { GearCounter, GemCounter } from './HallCounters';

export type GuildHallTab = 'tavern' | 'gems' | 'gear';

/** The three counters (2026-10-08, per user direction): a meal at the Tavern, Gems and Gear each a counter of their own. */
export function guildHallTabs(): readonly TabSpec<GuildHallTab>[] {
  return [
    { id: 'tavern', label: 'Tavern', glyph: 'heroes' },
    { id: 'gems', label: 'Gems', glyph: 'shop' },
    { id: 'gear', label: 'Gear', glyph: 'equipment' },
  ];
}

interface Props {
  run: RunState;
  /** Rolled once at node-select time (App.tsx, run/shop.ts rollGuildHallOffers). */
  offers: GuildHallOffers;
  /** Which counter is showing; the host owns the strip so it stays put above the scroll. */
  tab: GuildHallTab;
  /** Shelf Gems sold this visit (offers.gems indices). */
  gemsBought: readonly number[];
  /** Gear-counter slots sold this visit (offers.itemIds indices). */
  itemsBought: readonly number[];
  /** Hands off to App.tsx, which charges the gold and sets the Gem on the hero; the landed run, or null. */
  onBuyGem: (slot: number, rosterId: string) => RunState | null;
  /** What a bought Gem's pip opened, raised by the host (masteryFlow.ts). */
  onGemPlaced: (rosterId: string, landed: RunState, fromMastery: number) => void;
  /** Hands off to App.tsx, which charges the gold and seats the piece on the hero; the landed run, or null. */
  onBuyItem: (slot: number, rosterId: string, replaceIndex?: number) => RunState | null;
  /** The whole roster made whole for what is missing (run/wounds.ts mendPrice). */
  onBuyMend: () => void;
}

// Guild Hall (docs/run-loop.md "The Guild Hall"). One rule for every purchase: a tap opens the
// thing and the thing asks — or, for a good bought on the tap itself, the first tap arms it and
// the second pays.
export function GuildHallPanel({ run, offers, gemsBought, itemsBought, onBuyGem, onGemPlaced, onBuyItem, onBuyMend, tab }: Props) {
  /** What the mend costs right now: gold for what is missing (run/wounds.ts mendPrice), read off the same max HP the wound bars draw. */
  const mendCost = mendPrice(run, (entry) => entryHp(rosterHeroes[entry.heroId], entry, run.relics).maxHp);

  return (
    <div className="guild-hall">
      {tab === 'tavern' && (
        <div className="guild-hall-section is-tavern">
          {/* The bar: a hot meal for everyone — the mend, which since 2026-09-17 stands the downed up
              too, and is not for sale while nobody is hurt. */}
          <div className="hall-counter">
            <div className="hall-counter-goods">
              <HallGood
                art={GOOD_ART.mend}
                name="Party Heal"
                price={anyWounded(run) ? mendCost : 'Nobody hurt'}
                soldOut={!anyWounded(run)}
                disabled={!canBuyMend(run, mendCost)}
                confirm={mendCost >= CONFIRM_PURCHASE_FROM}
                onClick={onBuyMend}
              />
            </div>
            <img src={HALL_ART.counter} className="hall-counter-art" alt="" draggable={false} />
          </div>

          <TavernRoster run={run} />
        </div>
      )}

      {tab === 'gems' && <GemCounter run={run} gems={offers.gems} sold={gemsBought} onBuy={onBuyGem} onPlaced={onGemPlaced} />}

      {tab === 'gear' && <GearCounter run={run} itemIds={offers.itemIds} sold={itemsBought} onBuy={onBuyItem} />}
    </div>
  );
}

/** The roster at a glance under the bar, so the Party Heal is priced against who is actually hurt. */
function TavernRoster({ run }: { run: RunState }) {
  return (
    <div className="tavern-roster">
      {run.roster.map((entry) => {
        const hero = rosterHeroes[entry.heroId];
        const { hp, maxHp } = entryHp(hero, entry, run.relics);
        return (
          <div key={entry.rosterId} className={`tavern-roster-hero${entry.down ? ' is-down' : ''}`}>
            <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="tavern-roster-portrait" />
            {entry.down ? <span className="tavern-roster-down">Down</span> : <WoundBar hp={hp} maxHp={maxHp} className="tavern-roster-hp" />}
          </div>
        );
      })}
    </div>
  );
}
