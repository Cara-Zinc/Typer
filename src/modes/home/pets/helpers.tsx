// helpers.tsx — Tiny shared utilities for pet renderers. Kept minimal so
// each pet file stays self-explanatory; copy-paste a pet to make a new one.

import type { Gaze } from "../../../state/usePetBehavior";
import type { PetRenderState } from "./types";

/** Color-as-reward rule: accent only when happy AND fed (hunger > 50). */
export function shouldShowAccent({ mood, hunger, accent }: Pick<PetRenderState, "mood" | "hunger" | "accent">): boolean {
  return !!(accent && mood === "happy" && hunger > 50);
}

/** Clamp gaze to a small px offset for pupil tracking. */
export function pupil(gaze: Gaze, maxX = 3, maxY = 2): { x: number; y: number } {
  return {
    x: Math.max(-maxX, Math.min(maxX, gaze.x * maxX)),
    y: Math.max(-maxY, Math.min(maxY, gaze.y * maxY)),
  };
}

/** Tiny "z" mark shown when the pet is sleeping. */
export function SleepMark({ x = 100, y = 30, ink }: { x?: number; y?: number; ink: string }) {
  return (
    <text x={x} y={y} fontFamily="ui-monospace, monospace" fontSize="14" fill={ink} opacity="0.55">z</text>
  );
}

/** Ink/bg pair derived from dark prop. */
export function inks(dark: boolean): { ink: string; bg: string } {
  return dark ? { ink: "#fff", bg: "#000" } : { ink: "#000", bg: "#fff" };
}
