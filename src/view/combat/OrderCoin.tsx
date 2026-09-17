// The order coin's metal (CombatantCard `order`): a struck token in the mana gem's manufacture —
// halo, face, crown, rim, a milled inner ring and a spark, lit from the top left like every other
// surface. Inline SVG so the rim and halo are real geometry; the tint is CSS (`--coin-rgb` on
// .order-mark), so a tie, a cut, a hold and the current actor recolour the same die.
export function OrderCoin() {
  return (
    <svg className="order-coin" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle className="order-coin-halo" cx="12" cy="12" r="10.8" />
      <circle className="order-coin-face" cx="12" cy="12" r="10.2" />
      <path className="order-coin-crown" d="M2.2 12.6a9.8 9.8 0 0 1 19.6 0c-2.4-1.9-5.8-3-9.8-3s-7.4 1.1-9.8 3Z" />
      <circle className="order-coin-mill" cx="12" cy="12" r="8.8" />
      <circle className="order-coin-rim" cx="12" cy="12" r="10.2" />
      <path className="order-coin-spark" d="M4.6 8.6a8.6 8.6 0 0 1 4-4" />
    </svg>
  );
}
