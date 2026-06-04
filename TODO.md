# TODO - Triptych Stabilization Roadmap

Triptych is past the prototype-only stage: the current worktree already has
six top-level modes and several large feature batches. The next milestone is
to stabilize what exists, document it cleanly, and publish the branch for
review before expanding the feature set again.

## Current Status

- Top-level modes: Home, Reading Table, Typer, Magnifier, Archiver, Habits.
- Habits sub-tabs: Exchange, Slot, Shop, Owned, Redeemed, Pet.
- `npm run build` passes in this worktree. Vite reports a large chunk warning;
  that is a backlog item, not a release blocker.
- `npm run tauri dev` has not yet been fully smoke-tested end-to-end for the
  current feature batch.
- The worktree contains a large uncommitted Triptych feature set. Treat release
  prep as a stabilization pass, not a new feature sprint.

## Completed

- [x] Reader Markdown rendering supports GFM plus inline/block math through
      `remark-math`, `rehype-katex`, and KaTeX styling.
- [x] Reader Markdown write mode supports live block editing, task checkboxes,
      highlight/underline/strikethrough helpers, autosave for vault files, and
      split-pane reading.
- [x] Reader annotations are wired for vault-backed EPUB/PDF documents with
      highlight, underline, bookmark, list, jump, and remove flows.
- [x] Magnifier can load EPUB, Markdown, and text sources; build a part tree
      from EPUB TOC/spine, Markdown headings, or custom regex; preview parts;
      and extract one or all parts into `.triptych/extracts/`.
- [x] Habits core is integrated as a mounted top-level mode with global
      `appDataDir` JSON storage, serialized token/inventory writes, task logs,
      reward shop, slot machine, owned/redeemed inventories, stats strip, help
      modal, and backup/restore bundle support.
- [x] Home mode is integrated as the default landing mode with theme context,
      pet onboarding, pet registry, room/furniture registry, study/furnish/
      briefing views, persisted room layout, and Habits Pet food spending.
- [x] The old `TODO.txt` items are represented here: GitHub publishing and
      Jules Code Review belong to the stabilization/publish flow below.

## Next Milestone - Stabilize & Publish

- [ ] Run `npm run tauri dev` and smoke-test Reader:
      Markdown inline/block math, GFM tables/tasks, Read/Write switching,
      vault Markdown autosave, and split reader behavior.
- [ ] Smoke-test Magnifier:
      EPUB TOC/spine tree, Markdown heading depth, TXT regex split, Extract
      this, and Extract All into `.triptych/extracts/`.
- [ ] Smoke-test Habits:
      all six sub-tabs, token recording, Shop purchase, Slot spin/win/loss,
      Owned redeem confirmation, Redeemed records, backup export/import, data
      folder reveal, and PetFood token spend plus hunger persistence.
- [ ] Smoke-test Home:
      onboarding adoption, Study/Furnish/Briefing switching, furniture drag
      persistence to `pets/room.json`, pet placement, and dark theme rendering.
- [ ] Finish documentation cleanup:
      keep root `README.md` as the user-facing project guide, keep
      `src/README.md` as internal implementation notes only, and remove stale
      comments that refer to the old tab counts.
- [ ] Prepare the release branch:
      confirm the dirty worktree belongs to the Triptych feature batch, commit
      the stabilization docs/small fixes, push the branch to `origin`, open a
      draft PR, then request Jules Code Review after the PR is ready.

## Backlog

- Habits inventory source tracking: store whether each reward came from Shop
  or Slot and show a source breakdown in Owned when useful.
- Habits keyboard navigation: bind left/right arrows to cycle sub-tabs while
  Habits is active, skipping text fields, textareas, and selects.
- Habits Slot polish: decide whether reel icons should stay grayscale
  silhouettes or gain a lighter outline-only variant.
- Habits legacy import: optionally map old PyQt Atomic Habit Tracker data into
  the current stacked token/task/inventory schema if historical data matters.
- Habits performance: auto-pause Slot reel intervals while the Habits tab is
  hidden.
- Habits catalog editing: add in-app reward create/rename/remove flows only if
  editing `rewards.ts` becomes annoying.
- Home/Pet: add hunger decay, and gate cursor-follow behavior so hidden Home
  views do less background work.
- Home/Furniture: wire furniture prices into an unlock/purchase flow before
  letting every catalog item be added freely.
- Developer SVG atlas: build a standalone internal interface that renders every
  SVG/React illustration available to Triptych, including pets, furniture, and
  Habits reward goods, even if some assets are not exposed in the normal user
  interface. Include mono/color previews and useful metadata for designers.
- Reader/Magnifier: continue improving annotations, extraction metadata, and
  markdown editing ergonomics after the release branch is stable.
- Build packaging: consider Vite manual chunks or dynamic imports for PDF,
  EPUB, KaTeX, and document conversion dependencies if bundle size becomes a
  practical problem.

## Verification Notes

- Last confirmed command: `npm run build`.
- Build result: passed; Vite emitted only the known large chunk warning.
- Release blocker: complete the `tauri dev` smoke-test checklist above.
