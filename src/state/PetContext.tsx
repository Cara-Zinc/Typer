// PetContext.tsx — Current pet state, persisted to pets/pet.json.
//
// Same write-lock pattern as HabitsContext so two rapid feeds can't clobber
// the file. Hunger is bounded 0–100. Mood is a free union — the renderer
// decides how to interpret each value.

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

export type PetRecord = {
  kindId: string;
  mood: PetMood;
  hunger: number;
  name: string;
  adoptedAt: string; // ISO date
};

const NULL_PET: PetRecord | null = null;

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
      await lockedWrite(() => ({
        kindId,
        name,
        mood: "happy",
        hunger: 80,
        adoptedAt: new Date().toISOString(),
      }));
    },
    [lockedWrite],
  );

  const update = useCallback(
    async (patch: Partial<PetRecord>) => {
      await lockedWrite((current) => (current ? { ...current, ...patch } : current));
    },
    [lockedWrite],
  );

  const adjustHunger = useCallback(
    async (delta: number): Promise<number> => {
      const result = await lockedWrite((current) => {
        if (!current) return current;
        const hunger = Math.max(0, Math.min(100, current.hunger + delta));
        // Mood auto-shifts when hunger crosses thresholds, unless the user
        // has explicitly set 'sleep' (we leave that alone).
        let mood = current.mood;
        if (mood !== "sleep") {
          if (hunger >= 70 && delta > 0) mood = "happy";
          else if (hunger <= 25) mood = "hungry";
          else if (mood === "happy" || mood === "hungry") mood = "neutral";
        }
        return { ...current, hunger, mood };
      });
      return result?.hunger ?? 0;
    },
    [lockedWrite],
  );

  const feed = useCallback((amount: number) => adjustHunger(amount), [adjustHunger]);
  const drain = useCallback((amount: number) => adjustHunger(-amount), [adjustHunger]);

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
