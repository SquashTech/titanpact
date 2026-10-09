import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { heroes } from '../../data/heroes';
import { rosterHeroes } from '../../data/content';
import { guildHallOffersFor } from '../../data/recruitment';
import { ResourceGlyph } from '../shared/RunGlyph';
import type { HeroDefinition } from '../../engine/content';
import type { RunState } from '../../run/state';
import { ROSTER_CAP, RosterFullError } from '../../run/state';
import { guildHallEntry } from '../../run/guildRecruit';
import { guildHallLevel } from '../../run/difficulty';
import { anyWounded, canBuyMend, mendPrice } from '../../run/wounds';
import { WoundBar, entryHp } from '../shared/WoundBar';
import {
  recruitFromGuildHall,
  buyContract,
  contractPrice,
  CONTRACT_PRICE_STEP,
  RecruitmentError,
  type GuildHallOffer,
} from '../../run/recruitment';
import { tavernRerollCost, type GuildHallOffers } from '../../run/shop';
import { statScaleFor } from '../../run/statScale';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { formIdFor } from '../../run/progression';
import { HeroStageOverlay } from './HeroStageOverlay';
import { overlayHost } from '../shared/overlayHost';
import type { TabSpec } from '../shared/TabStrip';
import { RecruitFanfare } from './RecruitFanfare';
import { GOOD_ART, HALL_ART, HallGood } from './guildHallArt';
import { CONFIRM_PURCHASE_FROM } from '../shared/useArmedTap';
import { GearCounter, GemCounter } from './HallCounters';
import { ItemServicesSection } from './ItemServicesSection';

export type GuildHallTab = 'tavern' | 'gems' | 'gear' | 'smithy';

/** Every hire the game holds, bundles included: the roll already read the run's pool, so the lookup must not read it again. */
const allGuildHallOffers = guildHallOffersFor(heroes);

/** The hero shelf as the panel shows it: heroes already on the roster are off it. */
export function guildHeroOffers(run: RunState, offers: GuildHallOffers): GuildHallOffer[] {
  return offers.heroOfferIds
    .map((id) => allGuildHallOffers.find((o) => o.id === id))
    .filter((o): o is GuildHallOffer => !!o && !run.roster.some((r) => r.heroId === o.heroId));
}

/**
 * The three counters (2026-10-08, per user direction): people and provisions at the Tavern, Gems and
 * Gear each a counter of their own. The Vigil trades the Tavern for the Smithy — nobody joins for
 * the finale, and the last gold goes into the gear the roster already wears.
 */
export function guildHallTabs(run: RunState, offers: GuildHallOffers, vigil: boolean): readonly TabSpec<GuildHallTab>[] {
  const goods: TabSpec<GuildHallTab>[] = [
    { id: 'gems', label: 'Gems', glyph: 'shop' },
    { id: 'gear', label: 'Gear', glyph: 'equipment' },
  ];
  return vigil
    ? [...goods, { id: 'smithy', label: 'Smithy', glyph: 'equipment' }]
    : [{ id: 'tavern', label: 'Tavern', glyph: 'heroes', count: guildHeroOffers(run, offers).length }, ...goods];
}

interface Props {
  run: RunState;
  /** Rolled once at node-select time (App.tsx, run/shop.ts rollGuildHallOffers). */
  offers: GuildHallOffers;
  /** Which counter is showing; the host owns the strip so it stays put above the scroll. */
  tab: GuildHallTab;
  /** Shelf Gems sold this visit (offers.gems indices). */
  gemsBought: readonly number[];
  /** Tavern rerolls this visit; the next one costs tavernRerollCost(rerolls). */
  rerolls: number;
  /** Gear-counter slots sold this visit (offers.itemIds indices). */
  itemsBought: readonly number[];
  onRunChange: (next: RunState) => void;
  /** Hands off to App.tsx, which charges the gold and sets the Gem on the hero; the landed run, or null. */
  onBuyGem: (slot: number, rosterId: string) => RunState | null;
  /** What a bought Gem's pip opened, raised by the host (masteryFlow.ts). */
  onGemPlaced: (rosterId: string, landed: RunState, fromMastery: number) => void;
  /** Hands off to App.tsx, which charges the gold and seats the piece on the hero; the landed run, or null. */
  onBuyItem: (slot: number, rosterId: string) => RunState | null;
  /** Hands off to App.tsx, which charges the gold and swaps the shelf on the screen (run/shop.ts rerollGuildHallOffers). */
  onReroll: () => void;
  /** The whole roster made whole for what is missing (run/wounds.ts mendPrice). */
  onBuyMend: () => void;
  /** Recruiting at a full roster hands off to App.tsx's RosterReplaceScreen gate. */
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  /** Fires when this panel opens/closes a modal, so the host can pull its own bottom CTA. */
  onOverlayChange?: (open: boolean) => void;
}

interface HeroCardProps {
  hero: HeroDefinition;
  offer: GuildHallOffer;
  /** The act's hire level (difficulty.ts guildHallLevel) — on the card because a hire arrives one act behind, and that is what its contract is priced against. */
  level: number;
  affordable: boolean;
  onInspect: () => void;
}

// A tap puts the hire on the stage; the stage is where the contract is spent. Offers open with none held.
// Pinned to the Tavern's board as a parchment notice: the face, the name, what it is, what it asks.
function GuildHallHeroCard({ hero, offer, level, affordable, onInspect }: HeroCardProps) {
  return (
    <button
      className={`hall-poster${affordable ? '' : ' unaffordable'}`}
      style={{ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties}
      onClick={onInspect}
    >
      <span className="hall-poster-pin" aria-hidden="true" />
      <span className="hall-poster-level">Lv{level}</span>
      <HeroPortrait heroId={hero.id} className="hall-poster-portrait" />
      <span className="hall-poster-name">{hero.name}</span>
      <span className="hall-poster-types">
        {hero.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </span>
      <span className="hall-poster-price">
        <ResourceGlyph kind="contract" /> 1
      </span>
    </button>
  );
}

// Guild Hall (docs/progression.md "The raise-vs-recruit axis"). One rule for
// every purchase: a tap opens the thing and the thing asks — or, for a good bought on the tap
// itself, the first tap arms it and the second pays.
export function GuildHallPanel({
  run,
  offers,
  gemsBought,
  rerolls,
  itemsBought,
  onRunChange,
  onBuyGem,
  onGemPlaced,
  onBuyItem,
  onReroll,
  onBuyMend,
  onRequestRosterReplace,
  onOverlayChange,
  tab,
}: Props) {
  const [previewOfferId, setPreviewOfferId] = useState<string | null>(null);
  const [confirmingContract, setConfirmingContract] = useState(false);
  /** The hero the joining cinematic is running for. The roster-full path fires it from App instead. */
  const [fanfareHeroId, setFanfareHeroId] = useState<string | null>(null);

  const heroOffers = guildHeroOffers(run, offers);
  /** What the mend costs right now: gold for what is missing (run/wounds.ts mendPrice), read off the same max HP the wound bars draw. */
  const mendCost = mendPrice(run, (entry) => entryHp(rosterHeroes[entry.heroId], entry, run.relics).maxHp);

  const rosterFull = run.roster.length >= ROSTER_CAP;
  const previewOffer = previewOfferId ? heroOffers.find((o) => o.id === previewOfferId) : undefined;
  // The hire as it would arrive — its levels rolled (guildRecruit.ts), its kit authored, nothing evolved.
  const previewEntry = previewOffer ? guildHallEntry(run, previewOffer, 'preview') : null;
  const contractCost = contractPrice(run);
  const canBuyContract = run.gold >= contractCost;
  const canHire = run.recruitContracts > 0;
  const rerollCost = tavernRerollCost(rerolls);

  // Derived from state rather than pushed from each setter, so a later modal can't forget to report.
  const overlayOpen = !!previewOffer || confirmingContract || !!fanfareHeroId;
  useEffect(() => {
    onOverlayChange?.(overlayOpen);
  }, [overlayOpen, onOverlayChange]);

  function handleRecruit(offer: GuildHallOffer) {
    if (rosterFull) {
      if (canHire) onRequestRosterReplace(offer);
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
      onRunChange(buyContract(run));
    } catch (err) {
      if (!(err instanceof RecruitmentError)) throw err;
    }
  }

  return (
    <div className="guild-hall">
      {tab === 'tavern' && (
        <div className="guild-hall-section is-tavern">
          {/* The notice board: every hire on offer is a poster pinned to it. What a hire is — raw,
              unevolved — and what a full roster asks are both said on the hero's own stage. */}
          <div className="hall-board">
            <img src={HALL_ART.board} className="hall-board-art" alt="" draggable={false} />
            <div className="hall-board-posters">
              {heroOffers.length > 0 ? (
                heroOffers.map((offer) => (
                  <GuildHallHeroCard
                    key={offer.id}
                    hero={heroes[offer.heroId]}
                    offer={offer}
                    level={guildHallLevel(run.actNumber)}
                    affordable={canHire}
                    onInspect={() => setPreviewOfferId(offer.id)}
                  />
                ))
              ) : (
                <span className="hall-poster is-note">No one is looking for work this visit.</span>
              )}
            </div>
          </div>

          {/* The bar: the Contract, the bell that calls a fresh shelf of faces (dearer each ring this
              visit, dark with nobody left to call), and a hot meal for everyone — the mend, which
              since 2026-09-17 stands the downed up too, and is not for sale while nobody is hurt. */}
          <div className="hall-counter">
            <div className="hall-counter-goods">
              <HallGood
                art={GOOD_ART.contract}
                name="Contract"
                price={contractCost}
                held={run.recruitContracts > 0 ? run.recruitContracts : undefined}
                disabled={!canBuyContract}
                onClick={() => setConfirmingContract(true)}
              />
              <HallGood
                art={GOOD_ART.reroll}
                name="New Faces"
                price={rerollCost}
                disabled={run.gold < rerollCost || offers.heroOfferIds.length === 0}
                confirm={rerollCost >= CONFIRM_PURCHASE_FROM}
                onClick={onReroll}
              />
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

      {tab === 'smithy' && (
        <div className="guild-hall-section is-smithy">
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
              const affordable = canHire;
              return (
                <HeroStageOverlay
                  hero={hero}
                  entry={previewEntry}
                  relicIds={run.relics}
                  scale={statScaleFor(run)}
                  unowned
                  note={
                    !affordable
                      ? 'Hiring takes a Recruit Contract, and you hold none. The counter sells them.'
                      : rosterFull
                        ? `Roster is full (${ROSTER_CAP}/${ROSTER_CAP}) — you'll choose a hero to terminate next.`
                        : undefined
                  }
                  action={{
                    label: `Recruit ${hero.name} — 1 Contract`,
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
                    <span className="move-info-kind">{contractCost}g</span>
                  </div>
                  <div className="guild-hall-confirm-body">
                    Every recruit costs one: sign a hero you beat in a Skirmish or Elite, or hire one at this Tavern. The next one bought costs {contractCost + CONTRACT_PRICE_STEP}g.
                  </div>
                  <div className="guild-hall-confirm-ledger">
                    <span>
                      Gold {run.gold}g → <strong>{run.gold - contractCost}g</strong>
                    </span>
                    <span>
                      Contracts {run.recruitContracts} → <strong>{run.recruitContracts + 1}</strong>
                    </span>
                  </div>
                </div>
                <div className="detail-action">
                  <button className="resolve-button" disabled={!canBuyContract} onClick={handleBuyContract}>
                    Buy for {contractCost}g
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
