// PetContext.tsx — Current pet state, persisted to pets/pet.json.
//
// Same write-lock pattern as HabitsContext so two rapid feeds can't clobber
// the file. Hunger is bounded 0–100 and decays with real wall-clock time
// (`lastTick`), so the pet gets hungry whether or not the app is open. Mood is
// derived from hunger (except a user-set 'sleep', which we leave alone).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { petsFile } from "./petsPaths";
import type { PetMood } from "../modes/home/pets/types";

const PET_FILE = "pet.json";

// Hunger lost per real hour. At 3/h a full pet (100) reaches the "hungry"
// threshold (25) in ~25h and empties in ~33h — roughly a daily check-in.
const HUNGER_DECAY_PER_HOUR = 3;
// How often the in-app decay timer settles hunger while the app is open.
// Offline time is reconciled from `lastTick` regardless of this interval.
const TICK_MS = 60_000;

export type PetRecord = {
  kindId: string;
  mood: PetMood;
  hunger: number;
  name: string;
  adoptedAt: string; // ISO date
  lastTick: string; // ISO — when hunger was last settled (decay baseline)
};

const NULL_PET: PetRecord | null = null;

function clampHunger(value: number): number {
  return Math.max(0, Math.min(100, value));
}

// Mood follows hunger, but a deliberately-set 'sleep' is preserved so the
// decay timer doesn't wake a sleeping pet.
function moodForHunger(prev: PetMood, hunger: number): PetMood {
  if (prev === "sleep") return "sleep";
  if (hunger <= 25) return "hungry";
  if (hunger >= 70) return "happy";
  return "neutral";
}

// Apply elapsed-time hunger decay up to `nowMs` and re-baseline `lastTick`.
// Pure: callers persist the result. Because decay is computed from elapsed
// real time (not tick count), an irregular/throttled timer stays accurate.
function decayTo(rec: PetRecord, nowMs: number): PetRecord {
  const last = Date.parse(rec.lastTick);
  const lastMs = Number.isFinite(last) ? last : nowMs;
  const elapsedHours = Math.max(0, (nowMs - lastMs) / 3_600_000);
  const hunger = clampHunger(rec.hunger - elapsedHours * HUNGER_DECAY_PER_HOUR);
  return {
    ...rec,
    hunger,
    mood: moodForHunger(rec.mood, hunger),
    lastTick: new Date(nowMs).toISOString(),
  };
}

async function readPet(): Promise<PetRecord | null> {
  const path = await petsFile(PET_FILE);
  if (!(await exists(path))) return NULL_PET;
  try {
    const raw = await readTextFile(path);
    const parsed = JSON.parse(raw) as Partial<PetRecord>;
    if (!parsed.kindId) return NULL_PET;
    return {
      kindId: parsed.kindId,
      mood: (parsed.mood ?? "neutral") as PetMood,
      hunger: typeof parsed.hunger === "number" ? parsed.hunger : 70,
      name: parsed.name ?? "",
      adoptedAt: parsed.adoptedAt ?? new Date().toISOString(),
      // Legacy records predate decay: treat "now" as the baseline so an old
      // pet isn't instantly starved on first load after the update.
      lastTick: parsed.lastTick ?? new Date().toISOString(),
    };
  } catch {
    return NULL_PET;
  }
}

async function writePet(rec: PetRecord): Promise<void> {
  const path = await petsFile(PET_FILE);
  await writeTextFile(path, JSON.stringify(rec, null, 2));
}

type PetContextValue = {
  pet: PetRecord | null;
  loaded: boolean;
  /** First-time adoption — sets kind/name and timestamp. */
  adopt: (kindId: string, name: string) => Promise<void>;
  /** Re-write specific fields, persisting. */
  update: (patch: Partial<PetRecord>) => Promise<void>;
  /** Bump hunger by +n, capped 0–100. Returns new value. */
  feed: (amount: number) => Promise<number>;
  /** Bump hunger by -n, capped 0–100. Used by the future decay timer. */
  drain: (amount: number) => Promise<number>;
};

const PetContext = createContext<PetContextValue | null>(null);

export function PetProvider({ children }: { children: ReactNode }) {
  const [pet, setPet] = useState<PetRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const writeLockRef = useRef<Promise<void>>(Promise.resolve());

  // Load once on mount.
  useEffect(() => {
    void (async () => {
      try {
        setPet(await readPet());
      } catch {
        setPet(null);
      }
      setLoaded(true);
    })();
  }, []);

  const lockedWrite = useCallback(
    async (mut: (current: PetRecord | null) => PetRecord | null): Promise<PetRecord | null> => {
      let resolveWrite!: () => void;
      const next = new Promise<void>((r) => (resolveWrite = r));
      const prev = writeLockRef.current;
      writeLockRef.current = next;
      await prev;
      try {
        const current = await readPet();
        const updated = mut(current);
        if (updated) await writePet(updated);
        setPet(updated);
        return updated;
      } catch {
        return null;
      } finally {
        resolveWrite();
      }
    },
    [],
  );

  const adopt = useCallback(
    async (kindId: string, name: string) => {
      const now = new Date().toISOString();
      await lockedWrite(() => ({
        kindId,
        name,
        mood: "happy",
        hunger: 80,
        adoptedAt: now,
        lastTick: now,
      }));
    },
    [lockedWrite],
  );

  // Every mutation first settles pending decay (so changes apply to the
  // pet's *current* hunger, not a stale value) and re-baselines lastTick.
  const settleWrite = useCallback(
    (apply: (decayed: PetRecord) => PetRecord): Promise<PetRecord | null> =>
      lockedWrite((current) => (current ? apply(decayTo(current, Date.now())) : current)),
    [lockedWrite],
  );

  const update = useCallback(
    async (patch: Partial<PetRecord>) => {
      await settleWrite((decayed) => ({ ...decayed, ...patch }));
    },
    [settleWrite],
  );

  const adjustHunger = useCallback(
    async (delta: number): Promise<number> => {
      const result = await settleWrite((decayed) => {
        const hunger = clampHunger(decayed.hunger + delta);
        return { ...decayed, hunger, mood: moodForHunger(decayed.mood, hunger) };
      });
      return result?.hunger ?? 0;
    },
    [settleWrite],
  );

  const feed = useCallback((amount: number) => adjustHunger(amount), [adjustHunger]);
  const drain = useCallback((amount: number) => adjustHunger(-amount), [adjustHunger]);

  // Settle decay with no other change — used by the timer and focus/visibility
  // catch-ups so hunger keeps dropping while the app sits open or returns from
  // the background (where timers get throttled or suspended).
  const tick = useCallback(async () => {
    await settleWrite((decayed) => decayed);
  }, [settleWrite]);

  useEffect(() => {
    if (!loaded) return;
    void tick(); // reconcile time elapsed while the app/pet was last closed
    const id = window.setInterval(() => void tick(), TICK_MS);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [loaded, tick]);

  return (
    <PetContext.Provider value={{ pet, loaded, adopt, update, feed, drain }}>
      {children}
    </PetContext.Provider>
  );
}

export function usePet(): PetContextValue {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error("usePet must be used inside <PetProvider>");
  return ctx;
}
