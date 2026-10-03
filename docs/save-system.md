# save-system.md — run saves that survive anything (DESIGN, NOT BUILT)

> Drafted 2026-10-03 per user direction: "make sure run saves are rock solid and can even save
> mid-fight". Decisions D1–D4 below were made by the user the same day; the build waits on review
> of this document. Phases are ordered so each one ships alone.

---

## 1. What a save is today

- One localStorage key, `titanpact.run`, holding `{ version, savedAt, checkpoint, run }`
  (`src/run/save.ts`, `SAVE_VERSION` = 20). `decodeSave` validates the run against a content
  index and refuses a file from any other version.
- **Two checkpoints only**: `SaveCheckpoint = 'map' | 'actIntro'`. App's autosave effect
  (`src/app/App.tsx`, "Autosave") writes when the screen is one of those two and at no other time.
- A node is advanced on **completion** (`advanceToNode` from `handleFightResolved`,
  `handleNodeContinue` and the item claim), never on selection. So a reload anywhere off the map
  falls back to the map save with that node still ahead. Nothing can be handed out twice, but a
  reload can **undo** and **re-roll**.
- Storage failure is swallowed (`writeSave`'s catch), and a full quota loses the save silently.

## 2. What a reload costs or buys today

| Reloaded on | Effect |
|---|---|
| A fight | Same enemies (`encounterSeedFor`). New fight seed (`openBattle(Math.random…)`), new AI picks (`ai.ts` defaults to `Math.random`), new item, potion and level rolls. A losing fight can be restarted. |
| **The post-fight chain** (level report, item who-screen, companion, Banner, Crucible, recruit, Pact Seal) | `handleFightResolved` already committed the win in memory, but none of those screens save. **The whole win is thrown away and the fight replays with fresh drops.** This is the worst of the problems. |
| The Guild Hall | Purchases are refunded and the stock re-rolls (`shop.ts` uses `Math.random`). Tavern reroll gold comes back. |
| An event | A different event is rolled (`rollRunEvent` at node select), so gambles can be retried. |
| Boon, Crucible, Purse | Offers roll in a screen's `useState` (`pickBoonOffers`, `rollClassOffers`, `rollGoldRange`), so they re-roll on every mount. **Persisting the screen alone would not fix these.** |
| Fight Save & Quit | Goes to the title, and the fight replays by design. |

## 3. Decisions (user, 2026-10-03)

- **D1 — a mid-fight reload may re-declare the round, but the enemy's choices are fixed.** The
  dice already come from `CombatState.rngState`, and the AI's picks get seeded too (§5). A reload
  faces the same enemy moves; only the player's own choices can change.
- **D2 — rolls lock in on save.** A reload shows the same Boons, Classes, shop stock, event and
  purse, and keeps what was already bought. The free reroll ends.
- **D3 (follows from D2)** — the Guild Hall's visit counters (Scrolls and Revives bought, rerolls,
  gear sold) are restored with the screen.
- **D4 — an update never deletes a run.** A save from the previous version is read by a narrow
  reader that recovers its last map checkpoint, when the full decode refuses it.
- **Open — D5:** Save & Quit from a fight resumes the fight once phase B lands. The copy beside it
  (`FightScreen.tsx`, "Save & Quit") changes with it.

## 4. Phase A — a save on every screen (`SAVE_VERSION` 21)

1. **`src/run/resume.ts`** (new; `src/run` so the node tests can reach it):
   - Move App's `Screen` union here as `RunScreen`; App re-exports it.
   - Add `ResumePayload = { screen: RunScreen; combat?: CombatSnapshot }`.
   - Add `encodeResume`, plus `decodeResume(raw, index, run): ResumePayload | null`. It validates
     every kind recursively: node ids against `run.map`, hero, move and item ids against the
     index, `RosterEntry` fields through the existing roster decoder, and a depth cap on `next`.
     It returns null on any failure and never throws.
   - Add `isResumable(kind)` as an allow-list. It excludes `title`, the dev and sandbox kinds, and
     the run's end screens.
2. **Make every roll stable before it is persisted**, or a resume re-rolls anyway:
   - `fight.equipmentReward` (a catalog object) becomes `equipmentRewardId`.
   - Boon offers, Crucible offers and the purse amount are rolled in App when the screen is
     created and carried on the screen variant, not in a `useState`.
   - The Mentor's lesson is stored on the screen, the way the Tutor's already is.
3. **`src/run/save.ts`**:
   - The file becomes `{ version, savedAt, run, resume?, fallback: { run, checkpoint } }`.
     `fallback` is the last map or actIntro state, always written.
   - `decodeSave` returns `{ save, resume: ResumePayload | null }`. A bad resume degrades to the
     fallback pair and never to "unreadable".
   - The content index gains the enemy and Titan-eye ids, since `fight.encounter.run` holds an
     enemy roster.
   - **The D4 reader**: `decodeLegacyV20` restores the map checkpoint from a v20 file.
4. **`src/app/App.tsx`**:
   - The autosave effect writes on every resumable screen change.
   - Continue restores `resume.screen`, else `{ kind: fallback.checkpoint }`.
   - The "costs the fight" comment goes, and the reload-on-new-build gate widens to any screen
     except a fight or the Guild Hall.

## 5. Phase B — mid-fight resume

1. `CombatSnapshot = { state: CombatState; seed; usedConsumables; leadsPending; leadPicks; mvpLedger }`.
   - `CombatState` is plain JSON already: records, arrays, numbers, and a uint32 `rngState`.
   - The MVP ledger is kept as a running accumulator rather than the whole event log, to keep
     the save small.
   - The decoder checks combatant heroIds against the index, active and bench ids against
     `combatants`, and integer HP.
2. **Lift what must survive** out of FightScreen's local state: `combat`, `usedConsumables`,
   lead picks, the opening seed, and the MVP ledger. Everything else resets on resume:
   - In-progress declarations (`pending`, `selecting`, `pivoting`, `actionStep`,
     `replacementPick`) start empty.
   - Playback (`log`, `beat*`, `displayState`, fx) does not exist yet on resume. The board opens
     idle, with no intro.
3. FightScreen takes `initialSnapshot?` and calls `onCommandPhase(snapshot)` at four points:
   when playback ends and the board waits for declarations, after the lead pick, after a forced
   replacement, and after a potion (potions are irreversible).
4. **Seed the AI (D1)**: `aiContext.random` is derived from `(state.seed, round, combatantId)`,
   the same way the metamorphic faces are, so re-declaring after a reload meets the same enemy
   picks.

## 6. Phase C — durability (`src/app/saveStorage.ts`, pure parts in `src/run/saveEnvelope.ts`)

1. **Atomic swap**:
   - Write `titanpact.run.next` as `{ payload, checksum }` (FNV-1a), read it back and verify it.
   - Copy the current main key to `titanpact.run.bak`, write the main key, then remove `.next`.
   - On read, try main, then `.next`, then `.bak`, taking the first whose checksum and decode
     pass. The title says when a backup was used.
2. **Quota**: on `QuotaExceededError`, drop `.bak` and retry once. If that fails, write the
   fallback-only save and show a warning, where today the failure is silent.
3. **iOS eviction** (`polish-handoff.md` §4):
   - Call `navigator.storage.persist()` once at the first run start, if the browser has it.
   - Mirror every write to IndexedDB, asynchronously. Boot reads IndexedDB when localStorage is
     empty.
   - Write on `pagehide` and `visibilitychange` too.
   - All of it sits behind one `SaveBackend` interface, so Capacitor Preferences or a cloud save
     can plug in later without touching the format.

## 7. Tests

- `test/resume.test.ts`:
  - Every resumable kind round-trips, including nested `next` chains.
  - Bad node or item ids return null and the save falls back.
  - Dev kinds are refused.
- `test/save.test.ts`:
  - The v21 file, and a file without a resume payload.
  - The v20 legacy reader (D4).
  - The enemy-id index.
- `test/combatSnapshot.test.ts`:
  - A JSON round-trip of a mid-fight `CombatState` resolves the next round identically, given
    the same actions.
  - The seeded AI declares the same actions across a reload.
- `test/saveEnvelope.test.ts`:
  - The checksum.
  - The order of fallbacks on read.
  - The quota fallback.
