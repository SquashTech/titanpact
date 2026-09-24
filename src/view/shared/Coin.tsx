// A struck token in the mana gem's manufacture — halo, face, crown, rim, a milled inner ring and
// a spark, lit from the top left like every other surface. Drawn under whatever the caller strikes
// on it: the order mark's numeral (CombatantCard), a potion's flask (BagPanel, the Bag key, the
// Guild Hall shelf). Inline SVG so the rim and halo are real geometry; the tint is one CSS
// variable (`--coin-rgb` on the caller), so every state is a recolour of the same die. `split`
// strikes the right half in a second metal (`--coin-split-rgb`): the order mark's tie, a coin
// that is both of the places the coin flip decides between.
export function Coin({ split = false }: { split?: boolean } = {}) {
  return (
    <svg className="coin" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle className="coin-halo" cx="12" cy="12" r="10.8" />
      <circle className="coin-face" cx="12" cy="12" r="10.2" />
      {split && <path className="coin-split" d="M12 1.8a10.2 10.2 0 0 1 0 20.4Z" />}
      <path className="coin-crown" d="M2.2 12.6a9.8 9.8 0 0 1 19.6 0c-2.4-1.9-5.8-3-9.8-3s-7.4 1.1-9.8 3Z" />
      <circle className="coin-mill" cx="12" cy="12" r="8.8" />
      <circle className="coin-rim" cx="12" cy="12" r="10.2" />
      {split && <path className="coin-split-rim" d="M12 1.8a10.2 10.2 0 0 1 0 20.4" />}
      <path className="coin-spark" d="M4.6 8.6a8.6 8.6 0 0 1 4-4" />
    </svg>
  );
}
