import { useEffect, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { guildHallOffers, CONTRACT_PURCHASE_COST } from '../../data/recruitment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState } from '../../run/state';
import { ROSTER_CAP, RosterFullError, createRosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { recruitFromGuildHall, buyContract, RecruitmentError, type GuildHallOffer } from '../../run/recruitment';
import { EQUIPMENT_PRICE_BY_RARITY, type GuildHallOffers } from '../../run/shop';
import { getTypeColor } from '../combat/typeColors';
import { useLongPress } from '../shared/MoveTile';
import { EQUIP_SLOT_LABELS, EquipmentIcon, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { EquipInspectOverlay, itemHighlights } from './EquipChoiceCard';

interface Props {
  run: RunState;
  /** Rolled once at node-select time (App.tsx, run/shop.ts rollGuildHallOffers) — see that module's header for why this isn't rolled here in component state. */
  offers: GuildHallOffers;
  /**
   * Equipment already bought on this visit (App.tsx carries it on the `shop`
   * Screen, since a purchase unmounts this panel through the equip gate). The
   * card stays on the shelf, greyed and inert — see GuildHallEquipCard.
   */
  soldOutEquipmentIds: readonly string[];
  onRunChange: (next: RunState) => void;
  /** Equipment purchases hand off to App.tsx's forced equip-or-trash gate (ForceEquipScreen) — this panel can't transition screens itself. */
  onBuyEquipment: (itemId: string) => void;
  /** Recruiting while the roster is already full hands off to App.tsx's RosterReplaceScreen gate instead of the normal recruitFromGuildHall call — same reason as onBuyEquipment, this panel can't transition screens itself. */
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  /**
   * Fires whenever this panel opens or closes a modal of its own. The host
   * screen uses it to pull its bottom-docked Continue button (ShopNodeScreen)
   * — that button is a second full-width gold CTA sitting right under the hero
   * sheet's own "Recruit X" one, which read as part of the sheet and made the
   * recruit decision genuinely ambiguous (user report, 2026-08-31).
   */
  onOverlayChange?: (open: boolean) => void;
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
  soldOut: boolean;
  onBuy: () => void;
  onInspect: () => void;
}

/**
 * One item on the shelf, drawn as the same card the Equipment Cache and the
 * Loot Pile draw (EquipChoiceCard's `.equip-cache-*` family) — right down to
 * `itemHighlights`, the "+10 Attack · Ember Ward" benefit line.
 *
 * That line is the point of the 2026-08-31 pass. The shop card used to show
 * name/rarity/slot and a price, so the only way to learn what 90 gold was
 * buying was a ~500ms hold nobody discovers — every OTHER screen that offers
 * gear already spelled it out on the card face, and the one screen where the
 * item costs money was the one that didn't. The hold still opens the full
 * sheet (EquipInspectOverlay, for passive descriptions); it is no longer the
 * only way to read the item.
 *
 * A bought item stays on the shelf rather than vanishing: the stock is the
 * memory of what this Guild Hall had, and a card that disappears mid-scroll
 * reads as a bug. `sold-out` greys it and makes it inert.
 */
function GuildHallEquipCard({ item, cost, affordable, soldOut, onBuy, onInspect }: EquipCardProps) {
  const longPress = useLongPress(soldOut ? undefined : onInspect, soldOut ? undefined : onBuy);
  const highlights = itemHighlights(item);
  return (
    <button
      className={`equip-cache-card guild-hall-equip-card${soldOut ? ' sold-out' : affordable ? '' : ' unaffordable'}`}
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
      disabled={soldOut}
      {...longPress}
    >
      <div className="equip-cache-card-icon-badge">
        <EquipmentIcon item={item} slot={item.slot} className="equip-cache-card-icon" />
      </div>
      <div className="equip-cache-card-body">
        <div className="equip-cache-card-name">{item.name}</div>
        <div className="equip-cache-card-meta">
          <span className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</span>
          <span className="equip-cache-card-slot">{EQUIP_SLOT_LABELS[item.slot]}</span>
        </div>
        <div className="equip-cache-card-stats">{highlights.length > 0 ? highlights.join(' · ') : 'No effect'}</div>
      </div>
      {soldOut ? <span className="guild-hall-equip-soldout">Sold out</span> : <span className="guild-hall-equip-price">{cost}g</span>}
    </button>
  );
}

/**
 * Guild Hall (raise) recruitment (docs/progression.md "The raise-vs-recruit
 * axis"), overhauled per user direction (2026-08-18): only 2-3 heroes on
 * offer at a time (not the whole non-starter catalog) at a steeper price,
 * plus a small rotating shelf of equipment for sale — the Hall is now a real
 * shop, not just a hero-raise counter.
 *
 * Second pass, 2026-08-31 (user direction): the relic shelf is gone entirely
 * (see run/shop.ts's header for why), the equipment shelf widened to 4 and
 * now says what each item does on its face, a bought item greys out instead
 * of vanishing, and the Recruit Contract — the one purchase here that spends
 * gold on a thing you cannot look at — asks before it takes the money, next
 * to a readout of how many you already hold.
 */
export function GuildHallPanel({
  run,
  offers,
  soldOutEquipmentIds,
  onRunChange,
  onBuyEquipment,
  onRequestRosterReplace,
  onOverlayChange,
}: Props) {
  const [previewOfferId, setPreviewOfferId] = useState<string | null>(null);
  const [previewEquipId, setPreviewEquipId] = useState<string | null>(null);
  const [confirmingContract, setConfirmingContract] = useState(false);

  const heroOffers = offers.heroOfferIds
    .map((id) => guildHallOffers.find((o) => o.id === id))
    .filter((o): o is GuildHallOffer => !!o && !run.roster.some((r) => r.heroId === o.heroId));
  const equipmentOffers = offers.equipmentOfferIds.map((id) => equipment[id]).filter((i): i is EquipmentDefinition => !!i);

  const rosterFull = run.roster.length >= ROSTER_CAP;
  const previewOffer = previewOfferId ? heroOffers.find((o) => o.id === previewOfferId) : undefined;
  const previewEquip = previewEquipId ? equipmentOffers.find((i) => i.id === previewEquipId) : undefined;
  const canBuyContract = run.gold >= CONTRACT_PURCHASE_COST;

  /**
   * Tell the host screen whether one of this panel's modals is up, so it can
   * stand its own bottom CTA down (see `onOverlayChange`). Derived from the
   * three pieces of state rather than pushed from each setter, so a modal
   * added later can't forget to report itself.
   */
  const overlayOpen = !!previewOffer || !!previewEquip || confirmingContract;
  useEffect(() => {
    onOverlayChange?.(overlayOpen);
  }, [overlayOpen, onOverlayChange]);

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
    setConfirmingContract(false);
    try {
      onRunChange(buyContract(run, CONTRACT_PURCHASE_COST));
    } catch (err) {
      if (!(err instanceof RecruitmentError)) throw err;
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
          <span className="guild-hall-section-hint">Tap to buy · hold for details</span>
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
                  soldOut={soldOutEquipmentIds.includes(item.id)}
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
          <span className="guild-hall-section-title">📜 Contracts</span>
          {/* The count is what makes the price legible: a second contract is
              worth much less than a first if there is nothing left to beat,
              and the player cannot weigh that without knowing the balance. */}
          <span className="guild-hall-contract-held">
            You hold <strong>{run.recruitContracts}</strong>
          </span>
        </div>
        <button className="guild-hall-contract-row" disabled={!canBuyContract} onClick={() => setConfirmingContract(true)}>
          <span className="guild-hall-contract-icon">📜</span>
          <span className="guild-hall-contract-body">
            <span className="guild-hall-contract-name">Recruit Contract</span>
            <span className="guild-hall-contract-desc">Claim a beaten enemy hero for free, later.</span>
          </span>
          <span className="guild-hall-contract-price">{CONTRACT_PURCHASE_COST}g</span>
        </button>
      </div>

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

      {/* The same item sheet the Equipment Cache and the Loot Pile open, rather than this panel's own hand-rolled one — gear reads identically wherever it is offered. */}
      {previewEquip && <EquipInspectOverlay item={previewEquip} onClose={() => setPreviewEquipId(null)} />}

      {/* A Recruit Contract is the one purchase here with nothing to look at
          first — no stat sheet, no highlight line, just a row that took your
          gold the instant you brushed it. So it asks (user direction,
          2026-08-31), and the ask is where the gold arithmetic is spelled out. */}
      {confirmingContract && (
        <div className="log-overlay" onClick={() => setConfirmingContract(false)}>
          <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
            <div className="move-info-panel">
              <div className="move-info-head">
                <span className="move-info-name">📜 Recruit Contract</span>
                <span className="move-info-kind">{CONTRACT_PURCHASE_COST}g</span>
              </div>
              <div className="guild-hall-confirm-body">
                A blank contract lets you claim one beaten enemy hero onto your roster, free, after any winnable fight.
              </div>
              <div className="guild-hall-confirm-ledger">
                <span>
                  Gold {run.gold}g → <strong>{run.gold - CONTRACT_PURCHASE_COST}g</strong>
                </span>
                <span>
                  Contracts {run.recruitContracts} → <strong>{run.recruitContracts + 1}</strong>
                </span>
              </div>
            </div>
            <div className="detail-action">
              <button className="resolve-button" disabled={!canBuyContract} onClick={handleBuyContract}>
                Buy for {CONTRACT_PURCHASE_COST}g
              </button>
              <button className="detail-action-cancel" onClick={() => setConfirmingContract(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
