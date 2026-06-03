// registry.ts — Pet kind registry. Module-level Map keyed by id.
//
// Registered kinds survive a hot reload as long as the registering file is
// re-evaluated (side-effect imports in index.ts). Treat the registry as
// effectively static — once a pet is in it, nothing in the running app
// removes it.

import type { MBTIType, PetKind } from "./types";

const KINDS = new Map<string, PetKind>();

export function registerPet(kind: PetKind): void {
  if (!kind.id) {
    console.warn("registerPet: missing id", kind);
    return;
  }
  KINDS.set(kind.id, kind);
}

export function getPetKind(id: string): PetKind | undefined {
  return KINDS.get(id);
}

export function allPetKinds(): PetKind[] {
  return [...KINDS.values()];
}

/** Returns the first registered pet whose mbtiTypes includes `type`,
 *  falling back to any registered pet. Used by Onboarding. */
export function petForMBTI(type: MBTIType): PetKind | undefined {
  for (const k of KINDS.values()) {
    if (k.mbtiTypes.includes(type)) return k;
  }
  return KINDS.values().next().value;
}

/** The "default" — first registered. Used when storage has nothing yet. */
export function defaultPetKind(): PetKind | undefined {
  return KINDS.values().next().value;
}
