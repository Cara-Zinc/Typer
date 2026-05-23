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
import { habitsFile } from "./habitsPaths";

type TokensFile = { tokens: number; updatedAt?: string };

type HabitsContextValue = {
  tokens: number;
  loaded: boolean;
  add: (amount: number) => Promise<boolean>;
  spend: (amount: number) => Promise<boolean>;
  reload: () => Promise<void>;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

async function readTokens(): Promise<number> {
  const path = await habitsFile("tokens.json");
  if (!(await exists(path))) return 0;
  try {
    const raw = await readTextFile(path);
    const parsed = JSON.parse(raw) as TokensFile;
    return typeof parsed.tokens === "number" ? parsed.tokens : 0;
  } catch {
    return 0;
  }
}

async function writeTokens(tokens: number): Promise<void> {
  const path = await habitsFile("tokens.json");
  const body: TokensFile = { tokens, updatedAt: new Date().toISOString() };
  await writeTextFile(path, JSON.stringify(body, null, 2));
}

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Serialize writes so two rapid earn/spend calls can't race the file.
  const writeLockRef = useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      setTokens(await readTokens());
    } catch {
      setTokens(0);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = useCallback(
    async (delta: number, requireBalance: boolean): Promise<boolean> => {
      let resolveWrite!: () => void;
      const next = new Promise<void>((r) => (resolveWrite = r));
      const prev = writeLockRef.current;
      writeLockRef.current = next;
      await prev;
      try {
        const current = await readTokens();
        if (requireBalance && current + delta < 0) return false;
        const updated = current + delta;
        await writeTokens(updated);
        setTokens(updated);
        return true;
      } catch {
        return false;
      } finally {
        resolveWrite();
      }
    },
    [],
  );

  const add = useCallback(
    (amount: number) => (amount <= 0 ? Promise.resolve(false) : mutate(amount, false)),
    [mutate],
  );

  const spend = useCallback(
    (amount: number) => (amount <= 0 ? Promise.resolve(false) : mutate(-amount, true)),
    [mutate],
  );

  return (
    <HabitsContext.Provider value={{ tokens, loaded, add, spend, reload }}>
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabits(): HabitsContextValue {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error("useHabits must be used inside <HabitsProvider>");
  return ctx;
}
