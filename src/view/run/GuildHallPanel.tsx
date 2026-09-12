import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { guildHallOffers, CONTRACT_PURCHASE_COST, SCROLL_PURCHASE_COST, SCROLL_PURCHASE_LIMIT } from '../../data/recruitment';
import { ResourceGlyph } from '../shared/RunGlyph';
import { SectionGlyph } from '../shared/sectionIcons';
import type { HeroDefinition } from '../../engine/content';
import type { RunState } from '../../run/state';
import { ROSTER_CAP, RosterFullError } from '../../run/state';
import { guildHallEntry } from '../../run/guildRecruit';
import { guildHallLevel, scrollsFor } from '../../run/difficulty';
import type { EquipmentDefinition } from '../../run/equipment';
import {
  recruitFromGuildHall,
  buyContract,
  RecruitmentError,
  type GuildHallOffer,
} from '../../run/recruitment';
import { EQUIPMENT_PRICE_BY_RARITY, type GuildHallOffers } from '../../run/shop';
import { getTypeColor } from '../combat/typeColors';
import { EquipmentIcon, ItemEffectChips, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { overlayHost } from '../shared/overlayHost';
import type { TabSpec } from '../shared/TabStrip';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { EquipBuyOverlay } from './EquipBuyOverlay';
import { RecruitFanfare } from './RecruitFanfare';
import { SellSection } from './SellSection';

export type GuildHallTab = 'heroes' | 'shop';

/** The hero shelf as the panel shows it: heroes already on the roster are off it, and the Vigil's are free. */
export function guildHeroOffers(run: RunState, offers: GuildHallOffers, freeRecruits: boolean): GuildHallOffer[] {
  return offers.heroOfferIds
    .map((id) => guildHallOffers.find((o) => o.id === id))
    .filter((o): o is GuildHallOffer => !!o && !run.roster.some((r) => r.heroId === o.heroId))
    // Every downstream read goes through the offer's own cost, so zeroing it here is the whole discount.
    .map((offer) => (freeRecruits ? { ...offer, cost: 0 } : offer));
}

/** The two counters (2026-09-10, per user direction): people on one, the shop on the other. */
export function guildHallTabs(run: RunState, offers: GuildHallOffers, freeRecruits: boolean): readonly TabSpec<GuildHallTab>[] {
  return [
    { id: 'heroes', label: 'Heroes', glyph: 'heroes', count: guildHeroOffers(run, offers, freeRecruits).length },
    { id: 'shop', label: 'Shop', glyph: 'equipment', count: offers.equipmentOfferIds.length },
  ];
}

interface Props {
  run: RunState;
  /** Rolled once at node-select time (App.tsx, run/shop.ts rollGuildHallOffers). */
  offers: GuildHallOffers;
  /** Which counter is showing; the host owns the strip so it stays put above the scroll. */
  tab: GuildHallTab;
  /** Bought on this visit; carried by App.tsx so a re-render of this panel cannot forget it. */
  soldOutEquipmentIds: readonly string[];
  /** Scroll bundles bought this visit; carried by App.tsx for the same reason. */
  scrollsBought: number;
  onRunChange: (next: RunState) => void;
  /** Hands off to App.tsx, which charges the gold and drops the item in the bag. */
  onBuyEquipment: (itemId: string) => void;
  /** Hands off to App.tsx, which charges the gold, grants the act's bundle and counts the visit. */
  onBuyScrolls: () => void;
  /** Recruiting at a full roster hands off to App.tsx's RosterReplaceScreen gate. */
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  /** Fires when this panel opens/closes a modal, so the host can pull its own bottom CTA. */
  onOverlayChange?: (open: boolean) => void;
  /** The Vigil musters rather than sells: a 6v4 finale is a bug the player cannot see coming. */
  freeRecruits?: boolean;
}

interface HeroCardProps {
  hero: HeroDefinition;
  offer: GuildHallOffer;
  /** The act's hire level (difficulty.ts guildHallLevel) — on the card because a hire arrives one act behind, and that is what 50g is priced against. */
  level: number;
  affordable: boolean;
  onInspect: () => void;
}

// A tap opens the sheet; the sheet is where gold is spent. Unaffordable offers still open.
function GuildHallHeroCard({ hero, offer, level, affordable, onInspect }: HeroCardProps) {
  return (
    <button
      className={`guild-hall-hero-card${affordable ? '' : ' unaffordable'}`}
      style={{ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties}
      onClick={onInspect}
    >
      <span className="guild-hall-hero-level">Lv{level}</span>
      <HeroPortrait heroId={hero.id} className="guild-hall-hero-portrait" />
      <div className="guild-hall-hero-name">{hero.name}</div>
      <div className="roster-card-types">
        {hero.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      <div className="guild-hall-hero-cost">{offer.cost === 0 ? 'Free' : `${offer.cost}g`}</div>
    </button>
  );
}

interface EquipCardProps {
  item: EquipmentDefinition;
  cost: number;
  affordable: boolean;
  soldOut: boolean;
  onInspect: () => void;
}

// Same card as the Equipment Cache. A bought item stays on the shelf, greyed
// and inert — a card that vanishes mid-scroll reads as a bug.
function GuildHallEquipCard({ item, cost, affordable, soldOut, onInspect }: EquipCardProps) {
  return (
    <button
      className={`equip-cache-card guild-hall-equip-card${soldOut ? ' sold-out' : affordable ? '' : ' unaffordable'}`}
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
      disabled={soldOut}
      onClick={onInspect}
    >
      <div className="equip-cache-card-icon-badge">
        <EquipmentIcon item={item} className="equip-cache-card-icon" />
      </div>
      <div className="equip-cache-card-body">
        <div className="equip-cache-card-name">{item.name}</div>
        <div className="equip-cache-card-meta">
          <span className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</span>
        </div>
        <div className="equip-cache-card-stats">
          <ItemEffectChips item={item} />
        </div>
      </div>
      {soldOut ? (
        <span className="guild-hall-equip-soldout">Sold out</span>
      ) : (
        <span className="guild-hall-equip-price">
          <ResourceGlyph kind="gold" /> {cost}
        </span>
      )}
    </button>
  );
}

// Guild Hall (docs/progression.md "The raise-vs-recruit axis"). One rule for
// every purchase: a tap opens the thing, and the thing asks.
export function GuildHallPanel({
  run,
  offers,
  soldOutEquipmentIds,
  scrollsBought,
  onRunChange,
  onBuyEquipment,
  onBuyScrolls,
  onRequestRosterReplace,
  onOverlayChange,
  tab,
  freeRecruits = false,
}: Props) {
  const [previewOfferId, setPreviewOfferId] = useState<string | null>(null);
  const [previewEquipId, setPreviewEquipId] = useState<string | null>(null);
  const [confirmingContract, setConfirmingContract] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  /** The hero the joining cinematic is running for. The roster-full path fires it from App instead. */
  const [fanfareHeroId, setFanfareHeroId] = useState<string | null>(null);

  const heroOffers = guildHeroOffers(run, offers, freeRecruits);
  const equipmentOffers = offers.equipmentOfferIds.map((id) => equipment[id]).filter((i): i is EquipmentDefinition => !!i);

  const rosterFull = run.roster.length >= ROSTER_CAP;
  const previewOffer = previewOfferId ? heroOffers.find((o) => o.id === previewOfferId) : undefined;
  const previewEquip = previewEquipId ? equipmentOffers.find((i) => i.id === previewEquipId) : undefined;
  const canBuyContract = run.gold >= CONTRACT_PURCHASE_COST;
  const scrollsSoldOut = scrollsBought >= SCROLL_PURCHASE_LIMIT;
  // A fight's worth in this act (difficulty.ts scrollsFor): a single Scroll is a fraction of a rung now.
  const scrollBundle = scrollsFor('fight', run.actNumber);
  const canBuyScroll = !scrollsSoldOut && run.gold >= SCROLL_PURCHASE_COST;

  // Derived from state rather than pushed from each setter, so a later modal can't forget to report.
  const overlayOpen = !!previewOffer || !!previewEquip || confirmingContract || sellOpen || !!fanfareHeroId;
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
      setFanfareHeroId(offer.heroId);
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
      {tab === 'heroes' && (
        <div className="guild-hall-section">
          {/* The mark and nothing under it (2026-09-11, per user direction): what a hire is — raw,
              unevolved — and what a full roster asks are both said on the hero's own sheet, at the
              moment the gold is about to be spent. */}
          <div className="guild-hall-section-head">
            <span className="guild-hall-section-title">
              <SectionGlyph name="heroes" /> Recruits
            </span>
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
                    level={guildHallLevel(run.actNumber)}
                    affordable={run.gold >= offer.cost}
                    onInspect={() => setPreviewOfferId(offer.id)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="hint">No recruits on offer this visit.</p>
          )}
          {/* Two goods on a shelf, side by side. They used to be two full-width rows — glyph,
              name, gray sentence, price hard right — which is a shopping-cart line item, and it
              is what made the whole panel read as an invoice rather than as a counter. */}
          <div className="guild-hall-shelf">
            <button className="guild-hall-good is-contract" disabled={!canBuyContract} onClick={() => setConfirmingContract(true)}>
              <span className="guild-hall-good-glyph">
                <ResourceGlyph kind="contract" tone="inherit" />
              </span>
              <span className="guild-hall-good-name">Recruit Contract</span>
              <span className="guild-hall-good-price">
                <ResourceGlyph kind="gold" /> {CONTRACT_PURCHASE_COST}
              </span>
              {run.recruitContracts > 0 && (
                <span className="guild-hall-good-held" aria-label={`${run.recruitContracts} held`}>
                  {run.recruitContracts}
                </span>
              )}
            </button>
            {/* No confirm, unlike the Contract: Scrolls are spent later and on whoever you like, so
                there is nothing here to get wrong. Buying is the reversible half of the decision.
                The shelf holds SCROLL_PURCHASE_LIMIT bundles a visit, and the corner count is how
                many of them are already taken. */}
            <button
              className={`guild-hall-good is-scroll${scrollsSoldOut ? ' sold-out' : ''}`}
              disabled={!canBuyScroll}
              onClick={onBuyScrolls}
            >
              <span className="guild-hall-good-glyph">
                <ResourceGlyph kind="scroll" tone="inherit" />
              </span>
              <span className="guild-hall-good-name">{scrollBundle} Mastery Scrolls</span>
              {scrollsSoldOut ? (
                <span className="guild-hall-good-price is-soldout">Sold out</span>
              ) : (
                <span className="guild-hall-good-price">
                  <ResourceGlyph kind="gold" /> {SCROLL_PURCHASE_COST}
                </span>
              )}
              {scrollsBought > 0 && (
                <span className="guild-hall-good-held is-scroll" aria-label={`${scrollsBought} of ${SCROLL_PURCHASE_LIMIT} bought`}>
                  {scrollsBought}/{SCROLL_PURCHASE_LIMIT}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {tab === 'shop' && (
        <div className="guild-hall-section">
          <div className="guild-hall-section-head">
            <span className="guild-hall-section-title">
              <SectionGlyph name="equipment" /> Equipment
            </span>
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
                    onInspect={() => setPreviewEquipId(item.id)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="hint">No gear on offer this visit.</p>
          )}
        </div>
      )}

      {/* The Anvil and the Enchanter moved to the Blacksmith (2026-09-08, per user direction):
          the Guild Hall trades in heroes and gear, the Blacksmith works on gear you already own. */}
      {tab === 'shop' && <SellSection run={run} onRunChange={onRunChange} open={sellOpen} onOpenChange={setSellOpen} />}

      {fanfareHeroId && (
        <RecruitFanfare heroId={fanfareHeroId} source="guild" onDone={() => setFanfareHeroId(null)} />
      )}

      {/* Portalled: this panel lives inside the node screen's .screen-scroll, which is lifted to
          its own stacking context, and a modal rendered in there paints UNDER the corner buttons. */}
      {createPortal(
        <>
          {previewOffer &&
            (() => {
              const affordable = run.gold >= previewOffer.cost;
              return (
                <HeroPreviewOverlay
                  hero={heroes[previewOffer.heroId]}
                  entry={guildHallEntry(run, previewOffer, 'preview')}
                  equipmentLookup={equipment}
                  relicIds={run.relics}
                  unowned
                  action={{
                    label:
                      previewOffer.cost === 0
                        ? `Muster ${heroes[previewOffer.heroId].name}`
                        : `Recruit ${heroes[previewOffer.heroId].name} — ${previewOffer.cost}g`,
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
            <EquipBuyOverlay
              item={previewEquip}
              run={run}
              cost={EQUIPMENT_PRICE_BY_RARITY[previewEquip.rarity]}
              onBuy={() => {
                setPreviewEquipId(null);
                onBuyEquipment(previewEquip.id);
              }}
              onClose={() => setPreviewEquipId(null)}
            />
          )}

          {/* The one purchase with nothing to open first, so it gets its own confirm. */}
          {confirmingContract && (
            <div className="log-overlay" onClick={() => setConfirmingContract(false)}>
              <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
                <div className="move-info-panel">
                  <div className="move-info-head">
                    <span className="move-info-name">
                      <ResourceGlyph kind="contract" /> Recruit Contract
                    </span>
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
        </>,
        overlayHost()
      )}
    </div>
  );
}
