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
- [x] Developer SVG atlas is available as an internal interface at
      `#/dev/atlas`, rendering registered pets, furniture, and Habits reward
      SVG assets with mono/color, light/dark, sizing, search, and metadata
      inspection for designers/developers.
- [x] The old `TODO.txt` items are represented here: GitHub publishing and
      Jules Code Review belong to the stabilization/publish flow below.
- [x] Shared `VaultContext` lifts the connected vault path out of Archiver
      so any mode (Typer, Magnifier, future) can read it. Same localStorage
      key as the legacy Archiver-only persistence, so existing installs
      auto-restore.
- [x] Typer chapter management: left sidebar lists chapters from
      `<vault>/Drafts/_index.json`, "+ New Chapter" creates a Markdown
      file under `Drafts/`, header shows active title + dirty / saved /
      saving / save-failed state, ⌘S manual save, switching chapters
      auto-saves the current one first and aborts the switch on save
      failure. Falls back to ephemeral typewriter when no vault is
      connected, so the original Typer behavior is preserved.
- [x] Typer margin notes: hover any non-empty paragraph to reveal a
      floating "+ Note" button in the right margin, write a sticky note
      in-place, ⌘↩ saves / Esc cancels. Notes anchor by a 60-char
      snippet of the line (three-tier resolution: lineIdx hint → exact
      snippet → 30-char prefix fuzzy), so light edits to the paragraph
      don't lose the note. Notes whose paragraph is gone fall into an
      "Orphan notes" section below the manuscript instead of disappearing.
      Persistence: `<vault>/Drafts/_notes/<chapter-id>.json` per chapter.
- [x] Pet hunger decay: hunger now drops with real wall-clock time
      (`HUNGER_DECAY_PER_HOUR`, default 3/h ≈ a daily check-in) via a
      `lastTick` baseline in `pets/pet.json`. Decay is reconciled from
      elapsed time on load and on window focus/visibility, plus a 60s
      in-app timer, so the pet gets hungry whether or not the app is open.
      Mood follows hunger (happy ≥70, hungry ≤25; a user-set `sleep` is
      preserved). Feeding via the Habits Pet Food sub-tab settles pending
      decay first, then adds the food's hunger value.

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
- [ ] Smoke-test Typer:
      connect a vault, create a chapter, write + ⌘S, switch chapters and
      verify the auto-save-then-switch flow, restart and verify the
      chapter loads back. Add a margin note, edit the anchor paragraph
      lightly and confirm the note follows, delete the paragraph and
      confirm the note appears in the Orphan section. Inspect
      `<vault>/Drafts/_index.json`, the chapter `.md` file, and
      `<vault>/Drafts/_notes/<chapter-id>.json` on disk.
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
- Home/Pet: gate cursor-follow behavior so hidden Home views do less background
  work. (Hunger decay is done — see Completed.)
- Home/Furniture: wire furniture prices into an unlock/purchase flow before
  letting every catalog item be added freely.
- Reader/Magnifier: continue improving annotations, extraction metadata, and
  markdown editing ergonomics after the release branch is stable.
- Build packaging: consider Vite manual chunks or dynamic imports for PDF,
  EPUB, KaTeX, and document conversion dependencies if bundle size becomes a
  practical problem.
- Typer chapter rename: edit a chapter's title in the sidebar; rewrite the
  `# Title` line in the `.md` file and update `_index.json`. Filename can
  stay (it's an opaque ID) or be re-slugged on rename.
- Typer chapter delete: two-step confirm in the sidebar, soft-delete to
  `<vault>/Drafts/.archive/` rather than unlink so accidental deletes are
  recoverable for one session.
- Typer chapter reorder: drag-and-drop in the sidebar; the order is just
  the array order in `_index.json`, so this is pure UI work.
- Typer scratch auto-save: write the unsaved buffer to a `_scratch.md`
  every ~30 s as crash insurance. Originally proposed; deferred from MVP.
- Typer notes layout: use a `ResizeObserver` on the lines container so
  margin notes reposition when the text wraps due to width changes within
  the same window (currently only `window.resize` triggers a tick).
- Typer notes UX: hide the notes margin below a width breakpoint (no
  vault → already hidden; vault but narrow → currently overflows). Show
  an indicator that hidden notes still exist so the writer doesn't think
  they were lost.
- Typer notes UX: truncate long note bodies in the card view with a
  click-to-expand or click-to-edit affordance — currently very long notes
  make the card taller than the anchor line, which can visually overlap
  the next note.

## Verification Notes

- Last confirmed command: `npm run build`.
- Build result: passed; Vite emitted only the known large chunk warning.
- Release blocker: complete the `tauri dev` smoke-test checklist above.
