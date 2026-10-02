import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { heroes } from '../../data/heroes';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { anyoneCanReceive } from '../../run/runProgress';
import { equipmentArt } from '../shared/equipmentArt';
import { ItemDetailCard } from '../shared/ItemDossier';
import { RARITY_COLOR_VARS } from '../shared/EquipmentBox';
import { ItemServicesSection } from './ItemServicesSection';
import { guildHallOffersFor, CONTRACT_PURCHASE_COST } from '../../data/recruitment';
import { ResourceGlyph } from '../shared/RunGlyph';
import type { HeroDefinition } from '../../engine/content';
import type { RunState } from '../../run/state';
import { ROSTER_CAP, RosterFullError } from '../../run/state';
import { guildHallEntry } from '../../run/guildRecruit';
import { guildHallLevel } from '../../run/difficulty';
import { SCROLL_PACK_PIPS, SCROLL_PURCHASE_COST, SCROLL_PURCHASE_LIMIT, canBuyScroll } from '../../run/mastery';
import { CONSUMABLE_HOLD_CAP, CONSUMABLE_KINDS, CONSUMABLE_NAMES, REVIVE_PURCHASE_LIMIT, canBuyConsumable, consumablePrice, type ConsumableKind } from '../../run/consumables';
import { anyWounded, canBuyMend, mendPrice } from '../../run/wounds';
import { WoundBar, entryHp } from '../shared/WoundBar';
import {
  recruitFromGuildHall,
  buyContract,
  RecruitmentError,
  type GuildHallOffer,
} from '../../run/recruitment';
import { shopItemPrice, tavernRerollCost, type GuildHallOffers } from '../../run/shop';
import { statScaleFor } from '../../run/statScale';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroStageOverlay } from './HeroStageOverlay';
import { overlayHost } from '../shared/overlayHost';
import type { TabSpec } from '../shared/TabStrip';
import { RecruitFanfare } from './RecruitFanfare';
import { GOOD_ART, HALL_ART, HallGood } from './guildHallArt';

export type GuildHallTab = 'shop' | 'tavern' | 'smithy';

/** Every hire the game holds, bundles included: the roll already read the run's pool, so the lookup must not read it again. */
const allGuildHallOffers = guildHallOffersFor(heroes);

/** The hero shelf as the panel shows it: heroes already on the roster are off it. */
export function guildHeroOffers(run: RunState, offers: GuildHallOffers): GuildHallOffer[] {
  return offers.heroOfferIds
    .map((id) => allGuildHallOffers.find((o) => o.id === id))
    .filter((o): o is GuildHallOffer => !!o && !run.roster.some((r) => r.heroId === o.heroId));
}

/** The three counters (2026-09-24, per user direction): goods at the Shop, people at the Tavern, worn gear at the Smithy. */
export function guildHallTabs(run: RunState, offers: GuildHallOffers, vigil: boolean): readonly TabSpec<GuildHallTab>[] {
  return [
    { id: 'shop', label: 'Shop', glyph: 'shop' },
    // The Vigil's Tavern holds the mend alone, and a count of nobody would grey the tab it is on.
    { id: 'tavern', label: 'Tavern', glyph: 'heroes', count: vigil ? undefined : guildHeroOffers(run, offers).length },
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
  /** Revives bought this visit (run/consumables.ts REVIVE_PURCHASE_LIMIT). */
  revivesBought: number;
  /** Tavern rerolls this visit; the next one costs tavernRerollCost(rerolls). */
  rerolls: number;
  /** Gear-shelf slots sold this visit (offers.itemIds indices). */
  itemsBought: readonly number[];
  onRunChange: (next: RunState) => void;
  /** Hands off to App.tsx, which charges the gold and opens the who screen for the pip. */
  onBuyScroll: () => void;
  /** Hands off to App.tsx, which charges the gold and opens the who screen for the piece. */
  onBuyItem: (slot: number) => void;
  /** Hands off to App.tsx, which charges the gold and swaps the shelf on the screen (run/shop.ts rerollGuildHallOffers). */
  onReroll: () => void;
  /** Hands off to App.tsx, which charges the gold and fills the flask (run/consumables.ts). */
  onBuyConsumable: (kind: ConsumableKind) => void;
  /** The whole roster made whole for what is missing (run/wounds.ts mendPrice). */
  onBuyMend: () => void;
  /** Recruiting at a full roster hands off to App.tsx's RosterReplaceScreen gate. */
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  /** Fires when this panel opens/closes a modal, so the host can pull its own bottom CTA. */
  onOverlayChange?: (open: boolean) => void;
  /** Act 6's Vigil (2026-09-24, per user direction): no hires, no Contract, no reroll — the finale is fought by the roster the run kept. */
  vigil?: boolean;
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
        <ResourceGlyph kind="gold" /> {offer.cost}
      </span>
    </button>
  );
}

// Guild Hall (docs/progression.md "The raise-vs-recruit axis"). One rule for
// every purchase: a tap opens the thing, and the thing asks.
export function GuildHallPanel({
  run,
  offers,
  scrollsBought,
  revivesBought,
  rerolls,
  itemsBought,
  onRunChange,
  onBuyScroll,
  onBuyItem,
  onReroll,
  onBuyConsumable,
  onBuyMend,
  onRequestRosterReplace,
  onOverlayChange,
  tab,
  vigil = false,
}: Props) {
  const [previewOfferId, setPreviewOfferId] = useState<string | null>(null);
  const [confirmingContract, setConfirmingContract] = useState(false);
  /** The gear-shelf slot being looked at before it is paid for. */
  const [inspectingSlot, setInspectingSlot] = useState<number | null>(null);
  /** The hero the joining cinematic is running for. The roster-full path fires it from App instead. */
  const [fanfareHeroId, setFanfareHeroId] = useState<string | null>(null);

  const heroOffers = guildHeroOffers(run, offers);
  /** What the mend costs right now: gold for what is missing (run/wounds.ts mendPrice), read off the same max HP the wound bars draw. */
  const mendCost = mendPrice(run, (entry) => entryHp(rosterHeroes[entry.heroId], entry, run.relics).maxHp);

  const rosterFull = run.roster.length >= ROSTER_CAP;
  const previewOffer = previewOfferId ? heroOffers.find((o) => o.id === previewOfferId) : undefined;
  // The hire as it would arrive — its levels rolled (guildRecruit.ts), its kit authored, nothing evolved.
  const previewEntry = previewOffer ? guildHallEntry(run, previewOffer, 'preview') : null;
  const canBuyContract = run.gold >= CONTRACT_PURCHASE_COST;
  const scrollsSoldOut = scrollsBought >= SCROLL_PURCHASE_LIMIT;
  const canBuyScrollNow = canBuyScroll(run, scrollsBought);
  const rerollCost = tavernRerollCost(rerolls);

  // Derived from state rather than pushed from each setter, so a later modal can't forget to report.
  const overlayOpen = !!previewOffer || confirmingContract || inspectingSlot !== null || !!fanfareHeroId;
  const shelfItems = offers.itemIds.map((id) => equipment[id]);
  const inspectingItem = inspectingSlot !== null ? shelfItems[inspectingSlot] : undefined;
  const inspectingRoom = !!inspectingItem && anyoneCanReceive(run, inspectingItem, equipment, rosterHeroes);
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
      {tab === 'tavern' && (
        <div className="guild-hall-section is-tavern">
          {/* The notice board: every hire on offer is a poster pinned to it. What a hire is — raw,
              unevolved — and what a full roster asks are both said on the hero's own stage. */}
          {!vigil && (
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
                      affordable={run.gold >= offer.cost}
                      onInspect={() => setPreviewOfferId(offer.id)}
                    />
                  ))
                ) : (
                  <span className="hall-poster is-note">No one is looking for work this visit.</span>
                )}
              </div>
            </div>
          )}

          {/* The bar: the Contract, the bell that calls a fresh shelf of faces (dearer each ring this
              visit, dark with nobody left to call), and a hot meal for everyone — the mend, which
              since 2026-09-17 stands the downed up too, and is not for sale while nobody is hurt. */}
          <div className="hall-counter">
            <div className="hall-counter-goods">
              {!vigil && (
                <>
                  <HallGood
                    art={GOOD_ART.contract}
                    name="Contract"
                    price={CONTRACT_PURCHASE_COST}
                    held={run.recruitContracts > 0 ? run.recruitContracts : undefined}
                    disabled={!canBuyContract}
                    onClick={() => setConfirmingContract(true)}
                  />
                  <HallGood
                    art={GOOD_ART.reroll}
                    name="New Faces"
                    price={rerollCost}
                    disabled={run.gold < rerollCost || offers.heroOfferIds.length === 0}
                    onClick={onReroll}
                  />
                </>
              )}
              <HallGood
                art={GOOD_ART.mend}
                name="Party Heal"
                price={anyWounded(run) ? mendCost : 'Nobody hurt'}
                soldOut={!anyWounded(run)}
                disabled={!canBuyMend(run, mendCost)}
                onClick={onBuyMend}
              />
            </div>
            <img src={HALL_ART.counter} className="hall-counter-art" alt="" draggable={false} />
          </div>

          <TavernRoster run={run} />
        </div>
      )}

      {tab === 'shop' && (
        <div className="guild-hall-section is-shop">
          {/* The shelf: a pack of Mastery Scrolls (SCROLL_PACK_PIPS pips in any split, SCROLL_PURCHASE_LIMIT a visit, the tap opens the
              who screen), the flasks (the flask's own cap is the shelf's; the Revive is one a visit),
              and two pieces of gear on the bottom plank. */}
          <div className="hall-shelf">
            <img src={HALL_ART.shelf} className="hall-shelf-art" alt="" draggable={false} />
            <HallGood
              className="is-slot-1"
              art={GOOD_ART.scroll}
              name={`${SCROLL_PACK_PIPS} Mastery Scrolls`}
              price={scrollsSoldOut ? 'Sold out' : SCROLL_PURCHASE_COST}
              soldOut={scrollsSoldOut}
              held={scrollsSoldOut ? undefined : `${SCROLL_PURCHASE_LIMIT - scrollsBought} left`}
              disabled={!canBuyScrollNow}
              onClick={onBuyScroll}
            />
            {CONSUMABLE_KINDS.map((kind, i) => {
              const held = run.consumables[kind];
              const atCap = held >= CONSUMABLE_HOLD_CAP;
              const visitDone = kind === 'revive' && revivesBought >= REVIVE_PURCHASE_LIMIT;
              return (
                <HallGood
                  key={kind}
                  className={`is-slot-${i + 2}`}
                  art={GOOD_ART[kind === 'hpPotion' ? 'hp' : kind === 'mpPotion' ? 'mp' : 'revive']}
                  name={CONSUMABLE_NAMES[kind]}
                  price={atCap ? (kind === 'revive' ? 'Holding three' : 'Flask full') : visitDone ? 'One a visit' : consumablePrice(kind)}
                  soldOut={atCap || visitDone}
                  held={held > 0 ? `${held}/${CONSUMABLE_HOLD_CAP}` : undefined}
                  disabled={!canBuyConsumable(run, kind, revivesBought)}
                  onClick={() => onBuyConsumable(kind)}
                />
              );
            })}
            {/* The bottom plank: gear, one of each. The tap reads the piece whole before any gold moves. */}
            {shelfItems.map((item, i) => {
              if (!item) return null;
              const sold = itemsBought.includes(i);
              const noRoom = !sold && !anyoneCanReceive(run, item, equipment, rosterHeroes);
              return (
                <HallGood
                  key={i}
                  className={`is-slot-${i + 5} is-gear`}
                  style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
                  art={equipmentArt(item) ?? GOOD_ART.sack}
                  name={item.name}
                  price={sold ? 'Sold' : noRoom ? 'No room' : shopItemPrice(item)}
                  soldOut={sold || noRoom}
                  disabled={sold}
                  onClick={() => setInspectingSlot(i)}
                />
              );
            })}
          </div>
        </div>
      )}

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
                    label: `Recruit ${hero.name} — ${previewOffer.cost}g`,
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

          {/* A shelf piece read whole before any gold moves; the who screen seats it after. */}
          {inspectingItem && inspectingSlot !== null && (
            <div className="log-overlay" onClick={() => setInspectingSlot(null)}>
              <div
                className="log-panel move-popup-panel equip-inspect-panel"
                style={{ borderTopColor: RARITY_COLOR_VARS[inspectingItem.rarity] }}
                onClick={(e) => e.stopPropagation()}
              >
                <ItemDetailCard item={inspectingItem} />
                {!inspectingRoom ? (
                  <div className="guild-hall-confirm-body">Nobody has a free socket, or a piece of this family to merge it into.</div>
                ) : (
                  run.gold < shopItemPrice(inspectingItem) && (
                    <div className="guild-hall-confirm-body">
                      Not enough gold — {shopItemPrice(inspectingItem)}g needed, you have {run.gold}g.
                    </div>
                  )
                )}
                <div className="detail-action">
                  <button
                    className="resolve-button"
                    disabled={!inspectingRoom || run.gold < shopItemPrice(inspectingItem)}
                    onClick={() => {
                      setInspectingSlot(null);
                      onBuyItem(inspectingSlot);
                    }}
                  >
                    Buy for {shopItemPrice(inspectingItem)}g
                  </button>
                  <button className="detail-action-cancel" onClick={() => setInspectingSlot(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
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

/** The roster at a glance under the bar, so the Party Heal is priced against who is actually hurt. */
function TavernRoster({ run }: { run: RunState }) {
  return (
    <div className="tavern-roster">
      {run.roster.map((entry) => {
        const hero = rosterHeroes[entry.heroId];
        const { hp, maxHp } = entryHp(hero, entry, run.relics);
        return (
          <div key={entry.rosterId} className={`tavern-roster-hero${entry.down ? ' is-down' : ''}`}>
            <HeroPortrait heroId={hero.id} className="tavern-roster-portrait" />
            {entry.down ? <span className="tavern-roster-down">Down</span> : <WoundBar hp={hp} maxHp={maxHp} className="tavern-roster-hp" />}
          </div>
        );
      })}
    </div>
  );
}
