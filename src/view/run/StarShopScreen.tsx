import { STAR_SHOP_OFFERS, starShopCatalog } from '../../data/starShop';
import { totalStars, type Profile } from '../../run/profile';
import { canBuy, isPurchased, starBalance, starsSpent, type StarShopOffer } from '../../run/starShop';
import { HubGlyph } from '../shared/nodeIcons';

/** The shop's name, in one place: the title tile, this panel's header. A placeholder until it is workshopped. */
export const STAR_SHOP_NAME = 'Star Shop';

interface Props {
  profile: Profile;
  /** Spends stars on the offer and hands back the profile to render. */
  onBuy: (offer: StarShopOffer) => void;
  onClose: () => void;
}

/**
 * Where stars are spent (run/starShop.ts). The balance leads — earned, spent, left — then the
 * catalog, each offer a row with its price and one Buy. The catalog is empty for now
 * (data/starShop.ts says why), so what ships is the ledger and the room it will fill.
 */
export function StarShopScreen({ profile, onBuy, onClose }: Props) {
  const earned = totalStars(profile);
  const spent = starsSpent(profile, starShopCatalog);
  const balance = starBalance(profile, starShopCatalog);

  return (
    <div className="log-overlay roster-mgmt-overlay" onClick={onClose}>
      <div className="log-panel roster-panel star-shop-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>{STAR_SHOP_NAME}</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="screen-scroll">
          {/* The balance as the thing itself: one big star and the count, the ledger under it. */}
          <div className="star-shop-balance">
            <span className="star-shop-balance-star" aria-hidden="true">
              <HubGlyph name="star" />
            </span>
            <span className="star-shop-balance-count">{balance}</span>
            <span className="star-shop-balance-label">{balance === 1 ? 'star' : 'stars'} to spend</span>
            <span className="star-shop-balance-ledger">
              {earned} earned · {spent} spent
            </span>
          </div>
          <p className="records-note star-shop-note">
            A star is earned by clearing a run with a hero in one of its Evolutions — three a hero, one a form. Spending one never
            takes it off the hero: the Compendium keeps every star you have ever earned.
          </p>

          {STAR_SHOP_OFFERS.length === 0 ? (
            <div className="star-shop-empty">
              <span className="star-shop-empty-title">Nothing for sale yet</span>
              <span className="star-shop-empty-note">What stars buy is still being written. Keep earning them — the balance carries over.</span>
            </div>
          ) : (
            <div className="star-shop-offers">
              {STAR_SHOP_OFFERS.map((offer) => {
                const held = isPurchased(profile, offer.id);
                const affordable = canBuy(profile, starShopCatalog, offer);
                return (
                  <div key={offer.id} className={`star-shop-offer${held ? ' is-held' : ''}`}>
                    <div className="star-shop-offer-body">
                      <span className="star-shop-offer-name">{offer.name}</span>
                      <span className="star-shop-offer-desc">{offer.description}</span>
                    </div>
                    <button
                      type="button"
                      className="star-shop-offer-buy"
                      data-sfx={held ? 'none' : 'ui.commit'}
                      disabled={held || !affordable}
                      onClick={() => onBuy(offer)}
                      aria-label={held ? `${offer.name}: owned` : `Buy ${offer.name} for ${offer.cost} ${offer.cost === 1 ? 'star' : 'stars'}`}
                    >
                      {held ? 'Owned' : `★ ${offer.cost}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button className="resolve-button roster-close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
