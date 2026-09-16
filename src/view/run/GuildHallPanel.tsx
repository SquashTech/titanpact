import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { ItemServicesSection } from './ItemServicesSection';
import { guildHallOffers, CONTRACT_PURCHASE_COST } from '../../data/recruitment';
import { ResourceGlyph } from '../shared/RunGlyph';
import { SectionGlyph } from '../shared/sectionIcons';
import type { RunState } from '../../run/state';
import { ROSTER_CAP, RosterFullError } from '../../run/state';
import { guildHallEntry } from '../../run/guildRecruit';
import { guildHallLevel } from '../../run/difficulty';
import { SCROLL_PURCHASE_COST, SCROLL_PURCHASE_LIMIT, canBuyScroll } from '../../run/mastery';
import { CONSUMABLE_HOLD_CAP, CONSUMABLE_KINDS, CONSUMABLE_NAMES, CONSUMABLE_PRICE, canBuyConsumable, type ConsumableKind } from '../../run/consumables';
import { MEND_PRICE, anyWounded, canBuyMend } from '../../run/wounds';
import { StatGlyph } from '../shared/StatBars';
import { entryPassiveCounts, entryStatModifiers } from '../../run/entryStats';
import { passives } from '../../data/passives';
import { levelOf } from '../../run/growth';
import type { MoveDefinition } from '../../engine/content';
import { healCasterForEntry } from '../shared/healCaster';
import {
  StageCandidate,
  StageDais,
  StageFigure,
  StageKit,
  StageMovePopup,
  StageRail,
  StageSheet,
  StageTypes,
} from '../shared/HeroStage';
import {
  recruitFromGuildHall,
  buyContract,
  RecruitmentError,
  type GuildHallOffer,
} from '../../run/recruitment';
import type { GuildHallOffers } from '../../run/shop';
import { statScaleFor } from '../../run/statScale';
import { getTypeColorRgb } from '../combat/typeColors';
import { overlayHost } from '../shared/overlayHost';
import type { TabSpec } from '../shared/TabStrip';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
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

/** The two counters (2026-09-10, per user direction): people on one, the smithy — gear services, potions, the mend — on the other. */
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
  onBuyConsumable: (kind: ConsumableKind) => void;
  /** The whole roster made whole for MEND_PRICE (run/wounds.ts). */
  onBuyMend: () => void;
  /** Recruiting at a full roster hands off to App.tsx's RosterReplaceScreen gate. */
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  /** Fires when this panel opens/closes a modal, so the host can pull its own bottom CTA. */
  onOverlayChange?: (open: boolean) => void;
  /** The Vigil musters rather than sells: a 6v4 finale is a bug the player cannot see coming. */
  freeRecruits?: boolean;
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
  /** The hire on the dais. Falls back to the first offer once the featured one has been bought off the shelf. */
  const [featuredOfferId, setFeaturedOfferId] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [popupMove, setPopupMove] = useState<MoveDefinition | null>(null);
  const [confirmingContract, setConfirmingContract] = useState(false);
  /** The hero the joining cinematic is running for. The roster-full path fires it from App instead. */
  const [fanfareHeroId, setFanfareHeroId] = useState<string | null>(null);

  const heroOffers = guildHeroOffers(run, offers, freeRecruits);

  const rosterFull = run.roster.length >= ROSTER_CAP;
  const featuredOffer = heroOffers.find((o) => o.id === featuredOfferId) ?? heroOffers[0];
  // The hire as it would arrive — its levels rolled (guildRecruit.ts), its kit authored, nothing evolved.
  const featuredEntry = featuredOffer ? guildHallEntry(run, featuredOffer, 'preview') : null;
  const featuredHero = featuredOffer ? heroes[featuredOffer.heroId] : null;
  const previewOffer = inspecting ? featuredOffer : undefined;
  const canBuyContract = run.gold >= CONTRACT_PURCHASE_COST;
  const scrollsSoldOut = scrollsBought >= SCROLL_PURCHASE_LIMIT;
  const canBuyScrollNow = canBuyScroll(run, scrollsBought);

  // Derived from state rather than pushed from each setter, so a later modal can't forget to report.
  const overlayOpen = !!previewOffer || !!popupMove || confirmingContract || !!fanfareHeroId;
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
          {/* The hire on the draft's stage (shared/HeroStage.tsx): the dais, the fight's move
              console, the spend, and the other offers on the rail. What a hire is — raw, unevolved,
              one act behind — is read off the sheet itself: a level pip and no veteran marks. The
              rail LEADS here and the slab comes before the console, where the draft's order is dais,
              console, commit, rail: this stage sits in the Hall's scroll, and both the other offers
              and the spend have to be in reach without scrolling to them. */}
          {featuredOffer && featuredEntry && featuredHero ? (
            <div className="guild-hall-stage" style={{ '--pact-rgb': getTypeColorRgb(featuredHero.types[0]) } as CSSProperties}>
              {heroOffers.length > 1 && (
                <StageRail>
                  {heroOffers.map((offer) => {
                    const railHero = heroes[offer.heroId];
                    return (
                      <StageCandidate
                        key={offer.id}
                        heroId={railHero.id}
                        heroName={railHero.name}
                        primaryType={railHero.types[0]}
                        featured={offer.id === featuredOffer.id}
                        onSelect={() => setFeaturedOfferId(offer.id)}
                      />
                    );
                  })}
                </StageRail>
              )}

              <StageDais>
                <StageFigure key={featuredOffer.id} heroId={featuredHero.id} heroName={featuredHero.name} onInspect={() => setInspecting(true)}>
                  <span className="recruit-level" aria-label={`Level ${levelOf(featuredEntry)}`}>
                    Lv {levelOf(featuredEntry)}
                  </span>
                </StageFigure>
                <div className="draft-ident" key={`${featuredOffer.id}-ident`}>
                  <h3 className="draft-name">{featuredHero.name}</h3>
                  <StageTypes types={featuredHero.types} />
                  <StageSheet
                    baseStats={featuredHero.baseStats}
                    grants={entryStatModifiers(featuredEntry, equipment, passives, entryPassiveCounts(featuredEntry, equipment))}
                    scale={statScaleFor(run)}
                  />
                </div>
              </StageDais>

              {/* The slab sits under the dais, ahead of the console (per user direction): in the
                  Hall's scroll the spend has to be above the fold, where the draft's order would
                  put it under three rows of moves. */}
              {(() => {
                const affordable = run.gold >= featuredOffer.cost;
                return (
                  <button className="draft-choose recruit-sign" disabled={!affordable} onClick={() => handleRecruit(featuredOffer)}>
                    {!affordable
                      ? `Need ${featuredOffer.cost}g — you have ${run.gold}g`
                      : featuredOffer.cost === 0
                        ? `Muster ${featuredHero.name}`
                        : rosterFull
                          ? `Replace a hero for ${featuredHero.name} — ${featuredOffer.cost}g`
                          : `Recruit ${featuredHero.name} — ${featuredOffer.cost}g`}
                  </button>
                );
              })()}

              <StageKit
                key={`${featuredOffer.id}-kit`}
                moveIds={featuredEntry.unlockedMoveIds}
                caster={healCasterForEntry(featuredHero, featuredEntry)}
                onPick={setPopupMove}
              />
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
          </div>
        </div>
      )}

      {tab === 'smithy' && (
        <div className="guild-hall-section">
          <ItemServicesSection run={run} onRunChange={onRunChange} />
          {/* The potions, on the smithy's counter: consumed rather than worn, but bought the same way.
              No per-visit limit — the flask's own cap (CONSUMABLE_HOLD_CAP) is the shelf's. */}
          <div className="guild-hall-shelf">
            {CONSUMABLE_KINDS.map((kind) => {
              const held = run.consumables[kind];
              const atCap = held >= CONSUMABLE_HOLD_CAP;
              return (
                <button
                  key={kind}
                  className={`guild-hall-good is-${kind}${atCap ? ' sold-out' : ''}`}
                  disabled={!canBuyConsumable(run, kind)}
                  onClick={() => onBuyConsumable(kind)}
                >
                  <span className="guild-hall-good-glyph">
                    <ResourceGlyph kind={kind} tone="inherit" />
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
                the whole shelf. Dark while nobody is hurt — a heal with nothing to heal is not for sale. */}
            <button className={`guild-hall-good is-mend${anyWounded(run) ? '' : ' sold-out'}`} disabled={!canBuyMend(run)} onClick={onBuyMend}>
              <span className="guild-hall-good-glyph">
                <StatGlyph stat="hp" tone="inherit" />
              </span>
              <span className="guild-hall-good-name">Mend the company</span>
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

      {fanfareHeroId && (
        <RecruitFanfare heroId={fanfareHeroId} source="guild" onDone={() => setFanfareHeroId(null)} />
      )}

      {/* Portals itself (MoveDetailOverlay), so it needs no place in the block below. */}
      {popupMove && featuredHero && featuredEntry && (
        <StageMovePopup move={popupMove} caster={healCasterForEntry(featuredHero, featuredEntry)} onClose={() => setPopupMove(null)} />
      )}

      {/* Portalled: this panel lives inside the node screen's .screen-scroll, which is lifted to
          its own stacking context, and a modal rendered in there paints UNDER the corner buttons. */}
      {createPortal(
        <>
          {previewOffer && featuredEntry && (
            <HeroPreviewOverlay
              hero={heroes[previewOffer.heroId]}
              entry={featuredEntry}
              equipmentLookup={equipment}
              relicIds={run.relics}
              scale={statScaleFor(run)}
              unowned
              onClose={() => setInspecting(false)}
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
