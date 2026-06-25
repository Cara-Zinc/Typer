// types.ts — PetKind interface shared across registered pets.
//
// To add a pet, drop a file next to inkling.tsx, call registerPet({…}),
// and add `import "./yourPet";` to index.ts so the side-effect runs.

import type { ReactNode } from "react";
import type { Gaze } from "../../../state/usePetBehavior";
import type { IllustrationTone } from "../illustration";

export type PetMood =
  | "neutral"
  | "happy"
  | "sleep"
  | "hungry"
  | "curious";

export type MBTIType =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ"
  | "ISTP" | "ISFP" | "ESTP" | "ESFP";

/** State passed to every render call. */
export type PetRenderState = {
  mood: PetMood;
  blink: boolean;
  gaze: Gaze;
  hunger: number; // 0-100
  dark: boolean;
  /** CSS color used ONLY when mood='happy' AND hunger>50 — see the
   *  project-wide "color = reward" rule from CLAUDE.md. */
  accent: string | null;
  /** Mono is the current app default; color preserves illustration masters. */
  tone?: IllustrationTone;
};

export type PetKind = {
  /** Stable, unique. Persisted in pet.json. */
  id: string;
  /** Display name. */
  name: string;
  /** Display species (e.g. "Owl"). */
  species: string;
  /** One-line credo shown on the onboarding result + Home corner. */
  credo: string;
  /** Drives onboarding routing. Multiple types can share one kind. */
  mbtiTypes: MBTIType[];
  /** Height/width ratio of the render box. */
  aspect: number;
  /** Designer-defined renderer. Return a single <svg> or DOM tree. */
  render: (state: PetRenderState) => ReactNode;
};
