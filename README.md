# Triptych

Triptych is a local-first Tauri app for reading, writing, extracting book
sections, organizing a vault, and keeping a habit/reward loop in the same
workspace. The interface follows a strict black-and-white design language;
color is reserved for earned rewards and selected companion accents.

## Modes

- Home - default landing space with pet onboarding, a study room, furniture
  editing, and a compact briefing view.
- Reading Table - opens EPUB, PDF, DOC/DOCX, Markdown, plain text, JSON, and
  YAML. Markdown supports GFM, task checkboxes, and KaTeX math.
- Typer - typewriter-style writing surface.
- Magnifier - splits EPUB, Markdown, and text sources into part files under
  `.triptych/extracts/` in the connected vault.
- Archiver - vault browser and document launcher.
- Habits - token earning, rewards, slot machine, inventory, redemption, pet
  feeding, stats, and backup/restore.

## Development

```sh
npm install
npm run build
npm run tauri dev
```

Useful scripts:

- `npm run dev` starts the Vite frontend.
- `npm run build` runs TypeScript and the Vite production build.
- `npm run tauri dev` runs the desktop app for end-to-end smoke testing.

## Local Data

Triptych stores user data locally through Tauri app data directories.

- Habits data: `habits/tokens.json`, `habits/task_log.json`,
  `habits/inventory.json`.
- Pet and room data: `pets/pet.json`, `pets/room.json`.
- Vault reader annotations: `<vault>/.triptych/reader-annotations.json`.
- Magnifier extracts: `<vault>/.triptych/extracts/<source>/`.

## Current Roadmap

See [TODO.md](TODO.md) for the stabilization checklist and release backlog.
