// tips.ts — Speech bubble copy bank. Tone: bookish, dry, slightly literary.
// Add freely. Order doesn't matter — the bubble rotates randomly.

export const TIPS: readonly string[] = [
  "Good morning. The inkwell is full.",
  "Three hundred words gets you a Reading Hour.",
  "Your streak holds. Don't break it on a Tuesday.",
  "I noticed you walked past the Typer tab. We could talk.",
  "Tokens accrue for any deliberate effort. Even five minutes.",
  "When you redeem a reward, it's gone. That's the point.",
  "I'd like a berry. Or two. Whatever you can spare.",
  "Page 87 of The Magic Mountain — left where you sat down.",
  "Writing is editing. Editing is also writing.",
  "The room is warmer when the fire is lit.",
];

import { useEffect, useState } from "react";

/** Returns one of the tips, rotating every `intervalMs`. */
export function useRotatingTip(intervalMs: number = 9000): string {
  const [i, setI] = useState<number>(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => (x + 1) % TIPS.length), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return TIPS[i];
}
