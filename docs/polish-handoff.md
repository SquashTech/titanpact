# polish-handoff.md — what the polish pass left open (2026-10-02 playtest, updated 2026-10-03)

> A handoff between Claude sessions, not a design module. The full playtest write-up with
> screenshots is `art/concepts/2026-10-02-full-run/REPORT.md`; this file keeps only what is still
> open.

---

## 1. The playtest

One full Classic run at 375×812, won in 58.5 min of in-game time. One run: data points, not
findings. The fixes it led to are in git (`a38574dc`, `c81ff05d`, `a9c365e4`, `36f02f96`,
`0c5a1f64`) and the run-save build (`9c0b5a4a`, `docs/save-system.md`).

## 2. What the run showed that is still open

The boss lock (Mesmerize, now 3 Dazes a fight), Ghostlight's Force stack and Brain Flay's price are
fixed. Still unaddressed from the same run:
- **Progression ran fast:** two Evolutions in Act 1, three heroes at Mastery 10 by Act 3; a Common
  Tome merged up to Legendary by Act 2; 177–261g unspent through Act 4; Party Heal 5–25g.
- **Unbounded self-Force:** the +25 self-Force setup moves (Static Charge, Soulfire, Hoarfrost Edge,
  Undercurrent, Stoke the Flames), Deepsurge's +25 on hit and the Titanspawn Mark were left alone;
  the sim pilot never builds the stack, so play is the test.
- **Pacing:** ~14 screens after each Guardian, including up to five back-to-back replace-or-keep
  move decisions; ~25 tips in the first 15 minutes.
- **Clarity:** lead-pick arrows read as favourable against Ancient while the moves land at 0.5×;
  "7 moves · has room" means pool size, not kit; the Mentor's "powerful move" was twice a sidegrade.

## 3. Next (ranked)

1. **Auto-declining worse move offers** — NOT done: "strictly worse" has no definition yet
   (design call). Auto-target on a single legal target is built.
2. **Art consistency:** the Endbringer and the Titan's Eyes are flat vector shapes beside pixel-art
   heroes, and Early Titanspawn sprites are tiny — reads as unfinished in the biggest fights.

Built from this list: a one-tap good at 25g or more arms on the first tap and buys on the second
(`useArmedTap`, 4 s window; potions stay one tap), and the display fixes (Jackpot's BP range, the
Merged result, the landed delta on the combat move row, Physical / Magical on class cards).

Still open from before: status names in move text (*Conduct*, *Ambush 20*, *Sanctuary*) unexplained
outside their tap-sheet; PWA install prompt first on a new account; type wheel clips at 375 px;
the MVP label ("Tactician"/"Striker") unexplained; DEV stays visible on the title (deliberate).
Lore wording: "seals broken" reads as freeing the Titan; "the last two held" references seals the
player never saw.

## 4. Store readiness ($2.99 premium) — the short version

Content and core design are past the bar (combat depth, art, ~1 h runs, 84 heroes, Ascension, no
crash in a full hour). Run saves are now written on every screen with an IndexedDB mirror
(`docs/save-system.md`), but storage is still browser-only and iOS can evict it. Not shippable yet because of: **no
native wrapper (Capacitor), no cloud save or crash reporting**; a solvable difficulty curve; the
rough edges above; no audio pass; no store assets. Suggested order: native wrapper + cloud save →
balance → tap and screen cuts → audio + store assets.

## 5. Working notes for the next session

- Preview: `preview_start` name `titanpact-view`; `resize_window` preset `mobile`, then reload.
- The pane's storage is the user's test profile: back up `localStorage['titanpact.profile']` first
  and restore it inside a `pagehide` listener (the app writes on `pagehide`). Pre-seed `seenTipIds`
  (ids = the keys in `src/data/tips.ts` plus `lore`, `install`) to skip tips.
- Combat move rows sit at different y positions by kit size; prefer `find`/`get_page_text` + a
  fresh screenshot over fixed coordinates. Tip cards: dismiss via the `.tip-advance` element's rect.
- Node 14 is the system node; use `.node-runtime/node-v24.19.0-win-x64/node.exe` for `tsc` and tests
  (`tsc -p tsconfig.json && node dist/test/index.js`; view: `tsc -p tsconfig.view.json --noEmit`).
- Commit straight to `main`, by path. Stop the preview server before ending.
