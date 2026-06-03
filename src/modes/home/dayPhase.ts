// dayPhase.ts — Time-of-day → 'dawn'|'day'|'dusk'|'night'. Re-evaluates
// every minute so window/sconce/floor lamp can swap on their own.

import { useEffect, useState } from "react";
import type { DayPhase } from "./furniture/types";

export function dayPhaseFromDate(d: Date): DayPhase {
  const h = d.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

export function useDayPhase(): { phase: DayPhase; now: Date } {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return { phase: dayPhaseFromDate(now), now };
}
