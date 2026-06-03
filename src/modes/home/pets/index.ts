// index.ts — Pet barrel. Importing this file registers every starter pet.
//
// New pets: add a file alongside inkling.tsx, then `import "./yourPet";`
// here. The side-effect runs at module-eval time, populating the registry
// before the first render.

import "./inkling";
import "./cat";
import "./owl";
import "./fox";
import "./tortoise";
import "./sparkle";

export {
  registerPet,
  getPetKind,
  allPetKinds,
  petForMBTI,
  defaultPetKind,
} from "./registry";
export type { PetKind, PetMood, MBTIType, PetRenderState } from "./types";
