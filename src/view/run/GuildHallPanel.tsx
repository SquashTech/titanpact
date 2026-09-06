import { useEffect, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { guildHallOffers, CONTRACT_PURCHASE_COST } from '../../data/recruitment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState } from '../../run/state';
import { ROSTER_CAP, RosterFullError } from '../../run/state';
import { guildHallEntry } from '../../run/guildRecruit';
import { guildHallLevel } from '../../run/difficulty';
import type { EquipmentDefinition } from '../../run/equipment';
import { recruitFromGuildHall, buyContract, RecruitmentError, type GuildHallOffer } from '../../run/recruitment';
import { EQUIPMENT_PRICE_BY_RARITY, type GuildHallOffers } from '../../run/shop';
import { getTypeColor } from '../combat/typeColors';
import { EquipmentIcon, ItemEffectChips, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { EquipInspectOverlay } from './EquipChoiceCard';

interface Props {
  run: RunState;
  /** Rolled once at node-select time (App.tsx, run/shop.ts rollGuildHallOffers). */
  offers: GuildHallOffers;
  /** Bought on this visit; carried by App.tsx because a purchase unmounts this panel through the equip gate. */
  soldOutEquipmentIds: readonly string[];
  onRunChange: (next: RunState) => void;
  /** Hands off to App.tsx's forced equip-or-trash gate — this panel can't transition screens. */
  onBuyEquipment: (itemId: string) => void;
  /** Recruiting at a full roster hands off to App.tsx's RosterReplaceScreen gate. */
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  /** Fires when this panel opens/closes a modal, so the host can pull its own bottom CTA. */
  onOverlayChange?: (open: boolean) => void;
  /** Heading, so Act 6's Vigil is not a fourth Guild Hall (docs/run-loop.md §4). */
  title?: string;
  /** The Vigil musters rather than sells: a 6v4 finale is a bug the player cannot see coming. */
  freeRecruits?: boolean;
}

interface HeroCardProps {
  hero: HeroDefinition;
  offer: GuildHallOffer;
  /** The act's hire level (difficulty.ts guildHallLevel) — on the card because it is half of what 50g buys. */
  level: number;
  affordable: boolean;
  onInspect: () => void;
}

// A tap opens the sheet; the sheet is where gold is spent. Unaffordable offers still open.
function GuildHallHeroCard({ hero, offer, level, affordable, onInspect }: HeroCardProps) {
  return (
    <button
      className={`guild-hall-hero-card${affordable ? '' : ' unaffordable'}`}
      style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
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
      {soldOut ? <span className="guild-hall-equip-soldout">Sold out</span> : <span className="guild-hall-equip-price">{cost}g</span>}
    </button>
  );
}

// Guild Hall (docs/progression.md "The raise-vs-recruit axis"). One rule for
// every purchase: a tap opens the thing, and the thing asks.
export function GuildHallPanel({
  run,
  offers,
  soldOutEquipmentIds,
  onRunChange,
  onBuyEquipment,
  onRequestRosterReplace,
  onOverlayChange,
  title = 'Guild Hall',
  freeRecruits = false,
}: Props) {
  const [previewOfferId, setPreviewOfferId] = useState<string | null>(null);
  const [previewEquipId, setPreviewEquipId] = useState<string | null>(null);
  const [confirmingContract, setConfirmingContract] = useState(false);

  const heroOffers = offers.heroOfferIds
    .map((id) => guildHallOffers.find((o) => o.id === id))
    .filter((o): o is GuildHallOffer => !!o && !run.roster.some((r) => r.heroId === o.heroId))
    // Every downstream read goes through the offer's own cost, so zeroing it here is the whole discount.
    .map((offer) => (freeRecruits ? { ...offer, cost: 0 } : offer));
  const equipmentOffers = offers.equipmentOfferIds.map((id) => equipment[id]).filter((i): i is EquipmentDefinition => !!i);

  const rosterFull = run.roster.length >= ROSTER_CAP;
  const previewOffer = previewOfferId ? heroOffers.find((o) => o.id === previewOfferId) : undefined;
  const previewEquip = previewEquipId ? equipmentOffers.find((i) => i.id === previewEquipId) : undefined;
  const canBuyContract = run.gold >= CONTRACT_PURCHASE_COST;

  // Derived from state rather than pushed from each setter, so a later modal can't forget to report.
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
        <h2>{title}</h2>
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
        {rosterFull && (
          <p className="hint">
            Roster is full ({ROSTER_CAP}/{ROSTER_CAP}) — recruiting will ask you to terminate a hero to make room.
          </p>
        )}
        <button className="guild-hall-contract-row" disabled={!canBuyContract} onClick={() => setConfirmingContract(true)}>
          <span className="guild-hall-contract-icon">📜</span>
          <span className="guild-hall-contract-body">
            <span className="guild-hall-contract-name">Recruit Contract</span>
            <span className="guild-hall-contract-desc">Claim a beaten enemy hero for free, later.</span>
          </span>
          <span className="guild-hall-contract-held">{run.recruitContracts} held</span>
          <span className="guild-hall-contract-price">{CONTRACT_PURCHASE_COST}g</span>
        </button>
      </div>

      <div className="guild-hall-section">
        <div className="guild-hall-section-head">
          <span className="guild-hall-section-title">🛡️ Equipment</span>
          <span className="guild-hall-section-hint">Tap an item to view and buy</span>
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

      {previewEquip &&
        (() => {
          const cost = EQUIPMENT_PRICE_BY_RARITY[previewEquip.rarity];
          const affordable = run.gold >= cost;
          return (
            <EquipInspectOverlay
              item={previewEquip}
              roster={run.roster}
              action={{
                label: `Buy ${previewEquip.name} — ${cost}g`,
                disabled: !affordable,
                note: affordable
                  ? 'You will equip it, or trash it, before leaving the Hall.'
                  : `Not enough gold — ${cost}g needed, you have ${run.gold}g.`,
                onConfirm: () => {
                  setPreviewEquipId(null);
                  onBuyEquipment(previewEquip.id);
                },
              }}
              onClose={() => setPreviewEquipId(null)}
            />
          );
        })()}

      {/* The one purchase with nothing to open first, so it gets its own confirm. */}
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
