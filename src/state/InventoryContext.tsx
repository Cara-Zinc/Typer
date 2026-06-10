import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  acquire,
  readInventory,
  redeem,
  writeInventory,
  type InventoryRow,
} from "./inventory";

type InventoryContextValue = {
  rows: InventoryRow[];
  loaded: boolean;
  acquire: (rewardId: string, quantity?: number) => Promise<InventoryRow | null>;
  redeem: (rewardId: string) => Promise<InventoryRow | null>;
  reload: () => Promise<void>;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Serialize writes so two rapid acquires can't clobber each other.
  const writeLockRef = useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      setRows(await readInventory());
    } catch {
      setRows([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const doAcquire = useCallback(async (rewardId: string, quantity: number = 1): Promise<InventoryRow | null> => {
    let resolveWrite!: () => void;
    const next = new Promise<void>((r) => (resolveWrite = r));
    const prev = writeLockRef.current;
    writeLockRef.current = next;
    await prev;
    try {
      const current = await readInventory();
      const { rows: updated, row } = acquire(current, rewardId, quantity);
      await writeInventory(updated);
      setRows(updated);
      return row;
    } catch {
      return null;
    } finally {
      resolveWrite();
    }
  }, []);

  const doRedeem = useCallback(async (rewardId: string): Promise<InventoryRow | null> => {
    let resolveWrite!: () => void;
    const next = new Promise<void>((r) => (resolveWrite = r));
    const prev = writeLockRef.current;
    writeLockRef.current = next;
    await prev;
    try {
      const current = await readInventory();
      const result = redeem(current, rewardId);
      if (!result) return null;
      await writeInventory(result.rows);
      setRows(result.rows);
      return result.row;
    } catch {
      return null;
    } finally {
      resolveWrite();
    }
  }, []);

  return (
    <InventoryContext.Provider
      value={{ rows, loaded, acquire: doAcquire, redeem: doRedeem, reload }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside <InventoryProvider>");
  return ctx;
}
