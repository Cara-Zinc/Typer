// RoomLayoutContext.tsx — Placed furniture, persisted to pets/room.json.
//
// Layout is a plain array of refs into the furniture registry. The Room
// scene resolves kindId -> renderer at paint time. Reordering items in
// the array doesn't change z-order — DOM order is render order, so the
// last item paints on top.

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

const ROOM_FILE = "room.json";

export type PlacedItem = {
  id: string;
  kindId: string;
  x: number;
  y: number;
  flipped?: boolean;
};

export type RoomLayout = {
  items: PlacedItem[];
};

const EMPTY: RoomLayout = { items: [] };

async function readLayout(): Promise<RoomLayout | null> {
  const path = await petsFile(ROOM_FILE);
  if (!(await exists(path))) return null;
  try {
    const raw = await readTextFile(path);
    const parsed = JSON.parse(raw) as Partial<RoomLayout>;
    if (!Array.isArray(parsed.items)) return null;
    return { items: parsed.items as PlacedItem[] };
  } catch {
    return null;
  }
}

async function writeLayout(layout: RoomLayout): Promise<void> {
  const path = await petsFile(ROOM_FILE);
  await writeTextFile(path, JSON.stringify(layout, null, 2));
}

type RoomLayoutContextValue = {
  layout: RoomLayout;
  loaded: boolean;
  /** Replace the entire layout (used by Reset and first-load init). */
  setLayout: (next: RoomLayout) => Promise<void>;
  moveItem: (id: string, x: number, y: number) => Promise<void>;
  addItem: (item: PlacedItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
};

const RoomLayoutContext = createContext<RoomLayoutContextValue | null>(null);

type Props = {
  /** Fallback when no room.json exists yet — the canonical Study layout. */
  initialLayout: RoomLayout;
  children: ReactNode;
};

export function RoomLayoutProvider({ initialLayout, children }: Props) {
  const [layout, setLayoutState] = useState<RoomLayout>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const writeLockRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    void (async () => {
      const stored = await readLayout();
      const next = stored ?? initialLayout;
      setLayoutState(next);
      if (!stored) {
        // Persist the default so the user has something to drag around even
        // before they open Furnish.
        try {
          await writeLayout(next);
        } catch {
          /* ignore — display still works without persistence */
        }
      }
      setLoaded(true);
    })();
    // initialLayout is intentionally not in deps — only the first mount
    // value matters; later changes don't blow away the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lockedWrite = useCallback(
    async (mut: (current: RoomLayout) => RoomLayout): Promise<void> => {
      let resolveWrite!: () => void;
      const next = new Promise<void>((r) => (resolveWrite = r));
      const prev = writeLockRef.current;
      writeLockRef.current = next;
      await prev;
      try {
        const current = (await readLayout()) ?? layout;
        const updated = mut(current);
        await writeLayout(updated);
        setLayoutState(updated);
      } catch {
        /* ignore */
      } finally {
        resolveWrite();
      }
    },
    [layout],
  );

  const setLayout = useCallback(
    (next: RoomLayout) => lockedWrite(() => next),
    [lockedWrite],
  );
  const moveItem = useCallback(
    (id: string, x: number, y: number) =>
      lockedWrite((cur) => ({
        ...cur,
        items: cur.items.map((it) => (it.id === id ? { ...it, x, y } : it)),
      })),
    [lockedWrite],
  );
  const addItem = useCallback(
    (item: PlacedItem) =>
      lockedWrite((cur) => ({ ...cur, items: [...cur.items, item] })),
    [lockedWrite],
  );
  const removeItem = useCallback(
    (id: string) =>
      lockedWrite((cur) => ({
        ...cur,
        items: cur.items.filter((it) => it.id !== id),
      })),
    [lockedWrite],
  );

  return (
    <RoomLayoutContext.Provider
      value={{ layout, loaded, setLayout, moveItem, addItem, removeItem }}
    >
      {children}
    </RoomLayoutContext.Provider>
  );
}

export function useRoomLayout(): RoomLayoutContextValue {
  const ctx = useContext(RoomLayoutContext);
  if (!ctx) throw new Error("useRoomLayout must be used inside <RoomLayoutProvider>");
  return ctx;
}
