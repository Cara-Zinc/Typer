# TODO — Habit Tracker integration

Migration of the standalone PyQt5 Atomic Habit Tracker
(`~/self_learn/Atomic-Habit-Tracker/`) into Triptych as a fifth top-level
mode.

## Locked design contract

- Strict B/W chrome everywhere (1px borders, pure #000 / #FFF)
- **Color = reward**: reward icons render in their assigned brand color
  ONLY when in the Owned sub-tab. In Shop / Slot / Redeemed they stay
  monochrome (grayscale + reduced opacity). The contrast itself is the
  dopamine payoff.
- Storage is **global** under `~/Library/Application Support/com.triptych.app/habits/`
  — not vault-scoped (self-use app, no per-vault habits)
- Quantity stacking — one inventory row per reward kind with `owned` /
  `redeemed` counts; visual `×N` badge when > 1
- Redeem is **irreversible** (two-step confirm in UI)
- Sub-tab layout: `Exchange · Slot · Shop  |  Owned · Redeemed` with
  visual separator between transaction and collection tabs
- Live token counter pinned right side of sub-tab strip

## Done

- [x] `Habits` nav slot in App.tsx, mounted alongside other four tabs
      with `display:hidden` to preserve state across switches
- [x] `HabitsProvider` + `useHabits()` (tokens.json under appDataDir,
      serialized write lock)
- [x] `InventoryProvider` + `useInventory()` (inventory.json, acquire /
      redeem helpers with quantity stacking)
- [x] Sub-tab shell with grouped transaction / collection layout and
      live token counter
- [x] **Exchange** sub-tab — task type dropdown, description textarea,
      custom token spinner (±, min/max enforced), Record button with
      dynamic earn label, task_log.json history list
- [x] **Shop** sub-tab — 3-col responsive grid of tiles, grayscale
      silhouettes, "Owned · N" badge on already-owned, Buy disabled with
      "Need X more" hint when can't afford, flash toast on purchase
- [x] **Owned** sub-tab — color icons (variant="owned" with reward.color),
      ×N stacking badge, "Earned <date>" line, two-step redeem confirm
      (Confirm button inverts to filled black for urgency), empty-state
      copy framed by 1px border
- [x] **Redeemed** sub-tab — spent-variant icons (grayscale 0.4 opacity),
      strikethrough name, dimmed description, ×N badge when more than
      one redeemed, "Used <date>" line, no buttons (terminal), empty-state
      copy
- [x] **Slot Machine** sub-tab — three reels cycling silhouettes at 80ms,
      1400ms base spin + 500ms stagger, inverse-rarity weighted targets,
      win conditions (3-match → acquire 3, 2-match → acquire 1), color
      reveal on winning reels via `animateVariantChange`, scale pulse via
      `slot-reel-win` keyframe, "JACKPOT" / "WIN" / "Spin again" result
      lines, Spin button with cost label and disabled-when-broke tooltip
- [x] `RewardIcon` component normalizing raw SVGs to `currentColor`
      (attribute + style forms), with shop / owned / spent variants and
      optional `animateVariantChange` for smooth silhouette → color
      transitions
- [x] SVG normalize bugfix — handle multi-line `<svg>` tags and
      arbitrary attribute order (was breaking dessert/meal/sleep icons)
- [x] 10 reward SVGs copied to `src/assets/habits/`
- [x] Reward catalog (`rewards.ts`) — 9 default rewards with iconKey,
      rarity, brand color
- [x] **Exchange stats strip** — GitHub-commit-graph cell grids for
      Week / Month / Streak. Cells stay B/W when below threshold; reveal
      brand color when avg ≥ 150 tokens/day (Week green, Month blue) or
      streak ≥ 7 days (orange). Per-cell opacity shows intensity once
      unlocked. Pure helpers in `stats.ts`, presentation in
      `StatsStrip.tsx`

## Not done

Core integration is complete. Everything below is optional polish —
none of it blocks daily use of the Habit Tracker.

### Source tracking on inventory [small, low value]

`InventoryRow` doesn't track whether items came from Shop or Slot.
To surface "won from slot · earned 5/19" on Owned tiles:

```ts
type InventoryRow = {
  ...existing...
  sources: { shop: number; slot: number };
};
```

Add a `source` parameter to `acquire()` and bump the matching counter.
Update Owned tile to render source breakdown if mixed.

Skip unless you actually want the differentiation visible.

### Keyboard nav for sub-tabs [trivial]

Bind `←` / `→` to cycle through the 5 sub-tabs while Habits mode is
active. ~10 LOC `useEffect` + `keydown` listener in `Habits.tsx`. Skip
when text input / textarea / select is focused.

### Slot icon visual: silhouette vs outline [tiny, decision]

Currently the slot reel uses `variant="shop"` (grayscale fills, 0.55
opacity). After spinning a few dozen times, decide:
- Keep silhouettes — no change
- Switch to outline-only — new `variant="outline"` on RewardIcon with
  `fill: none; stroke: currentColor; stroke-width: 2`. Would feel
  lighter / more typographic.

### Legacy data import [medium, only if you have legacy data]

Detect `~/self_learn/Atomic-Habit-Tracker/app/data/*.json` on Habits
first-open, offer "Import legacy data" button. Maps:
- `tokens.json` → straight copy
- `task_log.json` → schema-match, append (preserve original timestamps)
- `inventory.json` / `reward_history.json` → roll up to stacked schema;
  legacy is event-list, count per `reward.name` and bucket into
  `owned` vs `redeemed`.

One-shot, removable after run. Skip if you don't actually have years
of old data to bring over.

### Backlog (no urgency)

- Inventory `_index.json` per-source manifest (only matters if we
  extend habits with non-reward item types)
- Redeem-confirm state survives tab switch (today it dies on unmount,
  which is fine — fix only if you hit it accidentally)
- Auto-pause Slot intervals when Habits tab is inactive (currently
  cycles in background, harmless but wasteful)
- Catalog editor — let user add/remove/rename rewards in-app instead
  of editing `rewards.ts`. Would also need migration of inventory rows
  when reward IDs change.

## Verification gaps

Not yet confirmed end-to-end in `tauri dev` this session:

- [ ] All five sub-tabs render and switch cleanly after the SVG fix
- [ ] dessert / meal / sleep icons render full-size (these were the
      empty-reel bug)
- [ ] Slot Machine: silhouettes read as "reel-like", not "flickering
      carousel"
- [ ] Files actually land at `~/Library/Application Support/com.triptych.app/habits/`

## Files touched / created

```
src/
  App.tsx                              modified — Habits nav slot + providers
  modes/
    Habits.tsx                         new — sub-tab shell
    habits/
      TokenExchange.tsx                new — form + history
      RewardShop.tsx                   new — tile grid
      Owned.tsx                        new — trophy case
      Redeemed.tsx                     new — spent records
      SlotMachine.tsx                  new — 3-reel cycling slot
      rewards.ts                       new — catalog + priceOf()
  components/
    RewardIcon.tsx                     new — SVG normalize + variants
  state/
    HabitsContext.tsx                  new — tokens + appDataDir storage
    InventoryContext.tsx               new — acquire/redeem state
    inventory.ts                       new — pure inventory helpers
    habitsPaths.ts                     new — appDataDir resolution
  assets/habits/
    bed.svg book.svg dayoff.svg
    dessert.svg game.svg meal.svg
    movie.svg shopping.svg sleep.svg
    tv.svg                             new — copied from legacy app
styles.css                             modified — slot pulse + spin keyframes
```

## Smoke test loop

1. `npm run tauri dev`
2. Habits → Exchange → record a task → token counter ticks up
3. Habits → Shop → buy a reward → flash, Owned badge appears
4. Habits → Owned → see tile in color, ×N if bought twice
5. Click Redeem → Confirm → tile disappears (or count drops)
6. Habits → Slot → SPIN; reels cycle silhouettes, then stagger-stop;
   winning reels reveal to color and pulse; inventory updates on win
7. `~/Library/Application Support/com.triptych.app/habits/` should
   contain `tokens.json`, `task_log.json`, and `inventory.json`
