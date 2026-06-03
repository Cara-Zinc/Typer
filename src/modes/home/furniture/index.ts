// index.ts — Furniture barrel. Side-effect imports populate the registry.

import "./items";

export {
  registerFurniture,
  getFurniture,
  allFurniture,
  furnitureByCategory,
} from "./registry";
export type {
  FurnitureKind,
  FurnitureCategory,
  FurnitureAnchor,
  FurnitureState,
  FurnitureRenderProps,
  DayPhase,
} from "./types";
export {
  makeStudyLayout,
  makeMinimalStudyLayout,
  makeLibraryLayout,
  makeGarretLayout,
} from "./layouts";
