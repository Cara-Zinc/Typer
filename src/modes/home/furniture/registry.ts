// registry.ts — Furniture registry. Same model as the pet registry.

import type { FurnitureCategory, FurnitureKind } from "./types";

const KINDS = new Map<string, FurnitureKind>();

export function registerFurniture(kind: FurnitureKind): void {
  if (!kind.id) {
    console.warn("registerFurniture: missing id", kind);
    return;
  }
  KINDS.set(kind.id, kind);
}

export function getFurniture(id: string): FurnitureKind | undefined {
  return KINDS.get(id);
}

export function allFurniture(): FurnitureKind[] {
  return [...KINDS.values()];
}

export function furnitureByCategory(cat: FurnitureCategory): FurnitureKind[] {
  return allFurniture().filter((f) => f.category === cat);
}
