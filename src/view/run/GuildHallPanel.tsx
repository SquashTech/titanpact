import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { ItemServicesSection } from './ItemServicesSection';
import { guildHallOffers, CONTRACT_PURCHASE_COST } from '../../data/recruitment';
import { ResourceGlyph } from '../shared/RunGlyph';
import { Coin } from '../shared/Coin';
import { SectionGlyph } from '../shared/sectionIcons';
import type { HeroDefinition } from '../../engine/content';
import type { RunState } from '../../run/state';
import { ROSTER_CAP, RosterFullError } from '../../run/state';
import { guildHallEntry } from '../../run/guildRecruit';
import { guildHallLevel } from '../../run/difficulty';
import { SCROLL_PURCHASE_COST, SCROLL_PURCHASE_LIMIT, canBuyScroll } from '../../run/mastery';
import { CONSUMABLE_HOLD_CAP, CONSUMABLE_NAMES, CONSUMABLE_PRICE, POTION_KINDS, canBuyConsumable, type PotionKind } from '../../run/consumables';
import { MEND_PRICE, anyWounded, canBuyMend } from '../../run/wounds';
import { StatGlyph } from '../shared/StatBars';
import {
  recruitFromGuildHall,
  buyContract,
  RecruitmentError,
  type GuildHallOffer,
} from '../../run/recruitment';
import type { GuildHallOffers } from '../../run/shop';
import { statScaleFor } from '../../run/statScale';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroStageOverlay } from './HeroStageOverlay';
import { overlayHost } from '../shared/overlayHost';
import type { TabSpec } from '../shared/TabStrip';
import { RecruitFanfare } from './RecruitFanfare';

export type GuildHallTab = 'heroes' | 'smithy';

/** The hero shelf as the panel shows it: heroes already on the roster are off it, and the Vigil's are free. */
export function guildHeroOffers(run: RunState, offers: GuildHallOffers, freeRecruits: boolean): GuildHallOffer[] {
  return offers.heroOfferIds
    .map((id) => guildHallOffers.find((o) => o.id === id))
    .filter((o): o is GuildHallOffer => !!o && !run.roster.some((r) => r.heroId === o.heroId))
    // Every downstream read goes through the offer's own cost, so zeroing it here is the whole discount.
    .map((offer) => (freeRecruits ? { ...offer, cost: 0 } : offer));
}

/** The two counters (2026-09-10, per user direction): people, potions and the party heal on one, the smithy's gear services on the other (2026-09-16: the potions and the heal moved over, per user direction). */
export function guildHallTabs(run: RunState, offers: GuildHallOffers, freeRecruits: boolean): readonly TabSpec<GuildHallTab>[] {
  return [
    { id: 'heroes', label: 'Heroes', glyph: 'heroes', count: guildHeroOffers(run, offers, freeRecruits).length },
    { id: 'smithy', label: 'Smithy', glyph: 'equipment', count: run.roster.reduce((n, entry) => n + entry.equipment.length, 0) },
  ];
}

interface Props {
  run: RunState;
  /** Rolled once at node-select time (App.tsx, run/shop.ts rollGuildHallOffers). */
  offers: GuildHallOffers;
  /** Which counter is showing; the host owns the strip so it stays put above the scroll. */
  tab: GuildHallTab;
  /** Mastery Scrolls bought this visit, carried the same way (run/mastery.ts SCROLL_PURCHASE_LIMIT). */
  scrollsBought: number;
  onRunChange: (next: RunState) => void;
  /** Hands off to App.tsx, which charges the gold and opens the who screen for the pip. */
  onBuyScroll: () => void;
  /** Hands off to App.tsx, which charges the gold and fills the flask (run/consumables.ts). */
  onBuyConsumable: (kind: PotionKind) => void;
  /** The whole roster made whole for MEND_PRICE (run/wounds.ts). */
  onBuyMend: () => void;
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

// A tap puts the hire on the stage; the stage is where gold is spent. Unaffordable offers still open.
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

// Guild Hall (docs/progression.md "The raise-vs-recruit axis"). One rule for
// every purchase: a tap opens the thing, and the thing asks.
export function GuildHallPanel({
  run,
  offers,
  scrollsBought,
  onRunChange,
  onBuyScroll,
  onBuyConsumable,
  onBuyMend,
  onRequestRosterReplace,
  onOverlayChange,
  tab,
  freeRecruits = false,
}: Props) {
  const [previewOfferId, setPreviewOfferId] = useState<string | null>(null);
  const [confirmingContract, setConfirmingContract] = useState(false);
  /** The hero the joining cinematic is running for. The roster-full path fires it from App instead. */
  const [fanfareHeroId, setFanfareHeroId] = useState<string | null>(null);

  const heroOffers = guildHeroOffers(run, offers, freeRecruits);

  const rosterFull = run.roster.length >= ROSTER_CAP;
  const previewOffer = previewOfferId ? heroOffers.find((o) => o.id === previewOfferId) : undefined;
  // The hire as it would arrive — its levels rolled (guildRecruit.ts), its kit authored, nothing evolved.
  const previewEntry = previewOffer ? guildHallEntry(run, previewOffer, 'preview') : null;
  const canBuyContract = run.gold >= CONTRACT_PURCHASE_COST;
  const scrollsSoldOut = scrollsBought >= SCROLL_PURCHASE_LIMIT;
  const canBuyScrollNow = canBuyScroll(run, scrollsBought);

  // Derived from state rather than pushed from each setter, so a later modal can't forget to report.
  const overlayOpen = !!previewOffer || confirmingContract || !!fanfareHeroId;
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
              unevolved — and what a full roster asks are both said on the hero's own stage, at the
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

            {/* The Mastery Scroll (docs/mastery.md §3): one pip. No confirm, unlike the Contract — the
                tap opens the who screen, and that is the decision. The shelf holds
                SCROLL_PURCHASE_LIMIT a visit, and the corner count is how many are already landed. */}
            <button
              className={`guild-hall-good is-scroll${scrollsSoldOut ? ' sold-out' : ''}`}
              disabled={!canBuyScrollNow}
              onClick={onBuyScroll}
            >
              <span className="guild-hall-good-glyph">
                <ResourceGlyph kind="scroll" tone="inherit" />
              </span>
              <span className="guild-hall-good-name">Mastery Scroll</span>
              <span className="guild-hall-good-desc">+1 Mastery</span>
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
            {/* The potions (2026-09-16, per user direction, off the Smithy's counter): consumed rather
                than worn. No per-visit limit — the flask's own cap (CONSUMABLE_HOLD_CAP) is the shelf's.
                The Revive is not sold: a KO that 20g undoes is not a KO (run/consumables.ts). */}
            {POTION_KINDS.map((kind) => {
              const held = run.consumables[kind];
              const atCap = held >= CONSUMABLE_HOLD_CAP;
              return (
                <button
                  key={kind}
                  className={`guild-hall-good is-${kind}${atCap ? ' sold-out' : ''}`}
                  disabled={!canBuyConsumable(run, kind)}
                  onClick={() => onBuyConsumable(kind)}
                >
                  {/* The flask on a coin (shared/Coin.tsx), as the Bag wears it in a fight. */}
                  <span className="guild-hall-good-glyph guild-hall-good-coin">
                    <Coin />
                    <ResourceGlyph kind={kind} tone="inherit" className="guild-hall-good-coin-glyph" />
                  </span>
                  <span className="guild-hall-good-name">{CONSUMABLE_NAMES[kind]}</span>
                  {atCap ? (
                    <span className="guild-hall-good-price is-soldout">Flask full</span>
                  ) : (
                    <span className="guild-hall-good-price">
                      <ResourceGlyph kind="gold" /> {CONSUMABLE_PRICE}
                    </span>
                  )}
                  {held > 0 && (
                    <span className={`guild-hall-good-held is-${kind}`} aria-label={`${held} of ${CONSUMABLE_HOLD_CAP} held`}>
                      {held}/{CONSUMABLE_HOLD_CAP}
                    </span>
                  )}
                </button>
              );
            })}
            {/* The mend (run/wounds.ts): the one good here that is for everyone at once, so it takes
                the whole shelf, and since 2026-09-17 it stands the downed up too. Dark while nobody is
                hurt — a heal with nothing to heal is not for sale. */}
            <button className={`guild-hall-good is-mend${anyWounded(run) ? '' : ' sold-out'}`} disabled={!canBuyMend(run)} onClick={onBuyMend}>
              <span className="guild-hall-good-glyph">
                <StatGlyph stat="hp" tone="inherit" />
              </span>
              <span className="guild-hall-good-name">Full Party Heal</span>
              {anyWounded(run) ? (
                <span className="guild-hall-good-price">
                  <ResourceGlyph kind="gold" /> {MEND_PRICE}
                </span>
              ) : (
                <span className="guild-hall-good-price is-soldout">Nobody hurt</span>
              )}
            </button>
          </div>
        </div>
      )}

      {tab === 'smithy' && (
        <div className="guild-hall-section">
          <ItemServicesSection run={run} onRunChange={onRunChange} />
        </div>
      )}

      {fanfareHeroId && (
        <RecruitFanfare heroId={fanfareHeroId} source="guild" onDone={() => setFanfareHeroId(null)} />
      )}

      {/* Portalled: this panel lives inside the node screen's .screen-scroll, which is lifted to
          its own stacking context, and a modal rendered in there paints UNDER the corner buttons. */}
      {createPortal(
        <>
          {/* The hire on the draft's stage (HeroStageOverlay), off its card (2026-09-16, per user
              direction — it stood in the tab itself for an afternoon and crowded the shelf out).
              What a hire is — raw, unevolved, one act behind — is read off the sheet itself: a
              level pip and no veteran marks. */}
          {previewOffer &&
            previewEntry &&
            (() => {
              const hero = heroes[previewOffer.heroId];
              const affordable = run.gold >= previewOffer.cost;
              return (
                <HeroStageOverlay
                  hero={hero}
                  entry={previewEntry}
                  relicIds={run.relics}
                  scale={statScaleFor(run)}
                  unowned
                  note={
                    !affordable
                      ? `Not enough gold — ${previewOffer.cost}g needed, you have ${run.gold}g.`
                      : rosterFull
                        ? `Roster is full (${ROSTER_CAP}/${ROSTER_CAP}) — you'll choose a hero to terminate next.`
                        : undefined
                  }
                  action={{
                    label: previewOffer.cost === 0 ? `Muster ${hero.name}` : `Recruit ${hero.name} — ${previewOffer.cost}g`,
                    disabled: !affordable,
                    onConfirm: () => {
                      handleRecruit(previewOffer);
                      setPreviewOfferId(null);
                    },
                  }}
                  onClose={() => setPreviewOfferId(null)}
                />
              );
            })()}

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
