# Triptych Source Notes

This file is for implementation notes that help future contributors navigate
the current source tree. Keep user-facing setup, mode summaries, and release
status in the root `README.md` and `TODO.md`.

## Home, Pet, and Room

Home is now the default top-level mode. It uses a small set of registries and
contexts so new pets and furniture can be added without touching the main app
shell.

- `state/ThemeContext.tsx` exposes light/dark state to SVG renderers.
- `state/PetContext.tsx` persists the adopted companion in `pets/pet.json`.
- `state/RoomLayoutContext.tsx` persists placed furniture in `pets/room.json`.
- `components/PetSprite.tsx` delegates drawing to registered pet kinds.
- `modes/Home.tsx` switches between Study, Furnish, and Briefing views.
- `modes/home/pets/` contains the pet registry and starter pet kinds.
- `modes/home/furniture/` contains the furniture registry, starter items, and
  default layouts.
- `modes/habits/PetFood.tsx` spends Habits tokens to raise pet hunger.

## Extending Registries

Add a pet by creating a file under `modes/home/pets/`, calling
`registerPet({ ... })`, and importing that file from `modes/home/pets/index.ts`
so the side effect runs before Home renders.

Add furniture by creating or editing a registration in
`modes/home/furniture/items.tsx`. `RoomEditor` reads the registry and groups
items by category automatically.

The current visual direction for pet and furniture SVGs is a maintainable
"literary grayscale diorama": layered vector shapes, hatching, shadows, and
state-aware details. `path`, `clipPath`, `mask`, and `pattern` are fine when
they make an illustration clearer, but keep the forms hand-editable rather
than opaque generated blobs.

## Deferred Work

Pet hunger decays with real wall-clock time: `PetContext` stores a `lastTick`
baseline in `pets/pet.json` and reconciles elapsed decay on load, on window
focus/visibility, and on a 60s timer, so the pet gets hungry whether or not the
app is open. Feeding (Habits Pet Food sub-tab) settles pending decay first.

Track project-level status in the root `TODO.md`. Current deferred Home/Pet
work includes cursor-follow throttling while Home is hidden and token-gated
furniture unlocks.
