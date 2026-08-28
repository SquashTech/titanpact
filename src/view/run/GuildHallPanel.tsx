import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import { guildHallOffers, CONTRACT_PURCHASE_COST } from '../../data/recruitment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState } from '../../run/state';
import { ROSTER_CAP, RosterFullError, createRosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import type { RelicDefinition } from '../../run/relics';
import { recruitFromGuildHall, buyContract, RecruitmentError, type GuildHallOffer } from '../../run/recruitment';
import { buyRelic, ShopError, EQUIPMENT_PRICE_BY_RARITY, RELIC_PURCHASE_COST, type GuildHallOffers } from '../../run/shop';
import { getTypeColor } from '../combat/typeColors';
import { useLongPress } from '../shared/MoveTile';
import { EQUIP_SLOT_LABELS, EquipmentIcon, RARITY_COLOR_VARS, RARITY_LABELS, EquipmentInfoPanel, RelicIcon } from '../shared/EquipmentBox';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

interface Props {
  run: RunState;
  /** Rolled once at node-select time (App.tsx, run/shop.ts rollGuildHallOffers) — see that module's header for why this isn't rolled here in component state. */
  offers: GuildHallOffers;
  onRunChange: (next: RunState) => void;
  /** Equipment purchases hand off to App.tsx's forced equip-or-trash gate (ForceEquipScreen) — this panel can't transition screens itself. */
  onBuyEquipment: (itemId: string) => void;
  /** Recruiting while the roster is already full hands off to App.tsx's RosterReplaceScreen gate instead of the normal recruitFromGuildHall call — same reason as onBuyEquipment, this panel can't transition screens itself. */
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
}

interface HeroCardProps {
  hero: HeroDefinition;
  offer: GuildHallOffer;
  affordable: boolean;
  onInspect: () => void;
}

/**
 * One recruit offer. A tap opens the hero's sheet, where the gold is actually
 * spent (user direction, 2026-08-28).
 *
 * It used to buy on the spot, with a ~500ms hold as the only way to see what
 * you were buying — so the fast, obvious gesture was the irreversible one and
 * the careful gesture was the hidden one. Every other permanent commitment in
 * the run (the draft, a Recruit Contract, a Class) shows the hero and then
 * asks; this is the same decision and now asks the same way. Unaffordable
 * offers still open — browsing a hero you cannot yet afford is the point of a
 * shop — and the sheet's confirm button is what goes inert.
 */
function GuildHallHeroCard({ hero, offer, affordable, onInspect }: HeroCardProps) {
  return (
    <button
      className={`guild-hall-hero-card${affordable ? '' : ' unaffordable'}`}
      style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
      onClick={onInspect}
    >
      <HeroPortrait heroId={hero.id} className="guild-hall-hero-portrait" />
      <div className="guild-hall-hero-name">{hero.name}</div>
      <div className="roster-card-types">
        {hero.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      <div className="guild-hall-hero-cost">{offer.cost}g</div>
    </button>
  );
}

interface EquipCardProps {
  item: EquipmentDefinition;
  cost: number;
  affordable: boolean;
  onBuy: () => void;
  onInspect: () => void;
}

/** Same tap-buys/hold-inspects split as GuildHallHeroCard above — pulled out for the same useLongPress-is-a-hook reason. */
function GuildHallEquipCard({ item, cost, affordable, onBuy, onInspect }: EquipCardProps) {
  const longPress = useLongPress(onInspect, onBuy);
  return (
    <button
      className={`equip-cache-card guild-hall-equip-card${affordable ? '' : ' unaffordable'}`}
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
      {...longPress}
    >
      <EquipmentIcon item={item} slot={item.slot} className="equip-cache-card-icon" />
      <div className="equip-cache-card-body">
        <div className="equip-cache-card-name">{item.name}</div>
        <div className="equip-cache-card-meta">
          <span className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</span>
          <span className="equip-cache-card-slot">{EQUIP_SLOT_LABELS[item.slot]}</span>
        </div>
      </div>
      <span className="guild-hall-equip-price">{cost}g</span>
    </button>
  );
}

interface RelicCardProps {
  relic: RelicDefinition;
  affordable: boolean;
  onBuy: () => void;
  onInspect: () => void;
}

/** Same tap-buys/hold-inspects split as GuildHallHeroCard above. */
function GuildHallRelicCard({ relic, affordable, onBuy, onInspect }: RelicCardProps) {
  const longPress = useLongPress(onInspect, onBuy);
  return (
    <button className={`relic-card guild-hall-relic-card${affordable ? '' : ' unaffordable'}`} {...longPress}>
      <div className="relic-card-head">
        <RelicIcon relicId={relic.id} className="relic-card-icon" />
        <span className="relic-card-name">{relic.name}</span>
        <span className="guild-hall-relic-price">{RELIC_PURCHASE_COST}g</span>
      </div>
    </button>
  );
}

/**
 * Guild Hall (raise) recruitment (docs/progression.md "The raise-vs-recruit
 * axis"), overhauled per user direction (2026-08-18): only 2-3 heroes on
 * offer at a time (not the whole non-starter catalog) at a steeper price,
 * plus a small rotating selection of equipment and relics for sale — the
 * Hall is now a real shop, not just a hero-raise counter. Recruit Contracts
 * (recruit) still aren't offered as heroes here — they're claimed off a
 * beaten enemy at fight's end (FightScreen) or bought blank below.
 *
 * Equipment and relic cards buy on a short tap and preview on a ~500ms hold.
 * Heroes no longer do (2026-08-28, user direction): a hero is permanent, the
 * priciest thing in the Hall, and the one purchase whose value is a page of
 * stats rather than a line of text, so its tap opens the sheet and the sheet
 * asks. See GuildHallHeroCard.
 */
export function GuildHallPanel({ run, offers, onRunChange, onBuyEquipment, onRequestRosterReplace }: Props) {
  const [previewOfferId, setPreviewOfferId] = useState<string | null>(null);
  const [previewEquipId, setPreviewEquipId] = useState<string | null>(null);
  const [previewRelicId, setPreviewRelicId] = useState<string | null>(null);

  const heroOffers = offers.heroOfferIds
    .map((id) => guildHallOffers.find((o) => o.id === id))
    .filter((o): o is GuildHallOffer => !!o && !run.roster.some((r) => r.heroId === o.heroId));
  const equipmentOffers = offers.equipmentOfferIds.map((id) => equipment[id]).filter((i): i is EquipmentDefinition => !!i);
  const relicOffers = offers.relicOfferIds
    .map((id) => relics[id])
    .filter((r): r is RelicDefinition => !!r && !run.relics.includes(r.id));

  const rosterFull = run.roster.length >= ROSTER_CAP;
  const previewOffer = previewOfferId ? heroOffers.find((o) => o.id === previewOfferId) : undefined;
  const previewEquip = previewEquipId ? equipmentOffers.find((i) => i.id === previewEquipId) : undefined;
  const previewRelic = previewRelicId ? relicOffers.find((r) => r.id === previewRelicId) : undefined;

  function handleRecruit(offer: GuildHallOffer) {
    if (rosterFull) {
      if (run.gold >= offer.cost) onRequestRosterReplace(offer);
      return;
    }
    try {
      onRunChange(recruitFromGuildHall(run, offer, offer.heroId));
    } catch (err) {
      if (!(err instanceof RecruitmentError) && !(err instanceof RosterFullError)) throw err;
    }
  }

  function handleBuyContract() {
    try {
      onRunChange(buyContract(run, CONTRACT_PURCHASE_COST));
    } catch (err) {
      if (!(err instanceof RecruitmentError)) throw err;
    }
  }

  function handleBuyRelic(relic: RelicDefinition) {
    try {
      onRunChange(buyRelic(run, relic));
    } catch (err) {
      if (!(err instanceof ShopError)) throw err;
    }
  }

  return (
    <div className="guild-hall">
      <div className="guild-hall-header">
        <h2>Guild Hall</h2>
        <span className="guild-hall-gold">💰 {run.gold}g</span>
      </div>

      <div className="guild-hall-section">
        <div className="guild-hall-section-head">
          <span className="guild-hall-section-title">⚔️ Recruits</span>
          <span className="guild-hall-section-hint">Tap a hero to view and recruit</span>
        </div>
        {heroOffers.length > 0 ? (
          <div className="guild-hall-hero-grid">
            {heroOffers.map((offer) => {
              const hero = heroes[offer.heroId];
              return (
                <GuildHallHeroCard
                  key={offer.id}
                  hero={hero}
                  offer={offer}
                  affordable={run.gold >= offer.cost}
                  onInspect={() => setPreviewOfferId(offer.id)}
                />
              );
            })}
          </div>
        ) : (
          <p className="hint">No recruits on offer this visit.</p>
        )}
        {rosterFull && (
          <p className="hint">
            Roster is full ({ROSTER_CAP}/{ROSTER_CAP}) — recruiting will ask you to terminate a hero to make room.
          </p>
        )}
      </div>

      <div className="guild-hall-section">
        <div className="guild-hall-section-head">
          <span className="guild-hall-section-title">🛡️ Equipment</span>
          <span className="guild-hall-section-hint">Hold an item to inspect</span>
        </div>
        {equipmentOffers.length > 0 ? (
          <div className="equip-cache-list guild-hall-equip-list">
            {equipmentOffers.map((item) => {
              const cost = EQUIPMENT_PRICE_BY_RARITY[item.rarity];
              return (
                <GuildHallEquipCard
                  key={item.id}
                  item={item}
                  cost={cost}
                  affordable={run.gold >= cost}
                  onBuy={() => onBuyEquipment(item.id)}
                  onInspect={() => setPreviewEquipId(item.id)}
                />
              );
            })}
          </div>
        ) : (
          <p className="hint">No gear on offer this visit.</p>
        )}
      </div>

      <div className="guild-hall-section">
        <div className="guild-hall-section-head">
          <span className="guild-hall-section-title">💠 Relics</span>
          <span className="guild-hall-section-hint">Hold a relic to inspect</span>
        </div>
        {relicOffers.length > 0 ? (
          <div className="relics-grid guild-hall-relic-list">
            {relicOffers.map((relic) => (
              <GuildHallRelicCard
                key={relic.id}
                relic={relic}
                affordable={run.gold >= RELIC_PURCHASE_COST}
                onBuy={() => handleBuyRelic(relic)}
                onInspect={() => setPreviewRelicId(relic.id)}
              />
            ))}
          </div>
        ) : (
          <p className="hint">No relics on offer this visit.</p>
        )}
      </div>

      <button className="guild-hall-contract-row" disabled={run.gold < CONTRACT_PURCHASE_COST} onClick={handleBuyContract}>
        <span className="guild-hall-contract-icon">📜</span>
        <span className="guild-hall-contract-body">
          <span className="guild-hall-contract-name">Recruit Contract</span>
          <span className="guild-hall-contract-desc">Claim a beaten enemy hero for free, later.</span>
        </span>
        <span className="guild-hall-contract-price">{CONTRACT_PURCHASE_COST}g</span>
      </button>

      {previewOffer &&
        (() => {
          const affordable = run.gold >= previewOffer.cost;
          return (
            <HeroPreviewOverlay
              hero={heroes[previewOffer.heroId]}
              entry={createRosterEntry('preview', previewOffer.heroId, previewOffer.startingMoveIds)}
              equipmentLookup={equipment}
              relicIds={run.relics}
              action={{
                label: `Recruit ${heroes[previewOffer.heroId].name} — ${previewOffer.cost}g`,
                disabled: !affordable,
                note: !affordable
                  ? `Not enough gold — ${previewOffer.cost}g needed, you have ${run.gold}g.`
                  : rosterFull
                    ? `Roster is full (${ROSTER_CAP}/${ROSTER_CAP}) — you'll choose a hero to terminate next.`
                    : undefined,
                onConfirm: () => {
                  handleRecruit(previewOffer);
                  setPreviewOfferId(null);
                },
              }}
              onClose={() => setPreviewOfferId(null)}
            />
          );
        })()}

      {previewEquip && (
        <div className="log-overlay" onClick={() => setPreviewEquipId(null)}>
          <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
            <EquipmentInfoPanel item={previewEquip} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}

      {previewRelic && (
        <div className="log-overlay" onClick={() => setPreviewRelicId(null)}>
          <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
            <div className="move-info-panel">
              <div className="move-info-head">
                <span className="move-info-name">{previewRelic.name}</span>
              </div>
              <div className="move-info-desc">{previewRelic.description ?? 'No effect described.'}</div>
            </div>
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
