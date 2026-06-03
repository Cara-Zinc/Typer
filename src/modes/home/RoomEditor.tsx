// RoomEditor.tsx — Furnish mode: drag-to-move + furniture catalog drawer.
//
// The drawer is the extension point: every registered FurnitureKind shows
// up here, grouped by category. Clicking adds it to the layout at a sane
// default position (left edge, anchor-aware).

import { useMemo, useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { Room } from "./Room";
import { useRoomLayout } from "../../state/RoomLayoutContext";
import { allFurniture, furnitureByCategory, getFurniture } from "./furniture";
import { ROOM_DIMENSIONS, makeStudyLayout } from "./furniture/layouts";
import type { FurnitureCategory, FurnitureState } from "./furniture/types";
import type { PetMood } from "./pets";

type Props = {
  state: FurnitureState;
  dark: boolean;
  accent: string | null;
  pet: {
    kindId: string;
    mood: PetMood;
    hunger: number;
    x: number;
    y: number;
    size: number;
  } | null;
};

const CATEGORY_ORDER: FurnitureCategory[] = [
  "surface", "seating", "storage", "lighting", "window", "decor", "rug",
];

export function RoomEditor({ state, dark, accent, pet }: Props) {
  const { layout, setLayout, moveItem, addItem, removeItem } = useRoomLayout();
  const [selected, setSelected] = useState<string | null>(null);

  function onAdd(kindId: string) {
    const kind = getFurniture(kindId);
    if (!kind) return;
    const id = `f-${kindId}-${Date.now().toString(36).slice(-4)}`;
    const x = 60;
    const y = kind.anchor === "wall" ? 100 : ROOM_DIMENSIONS.floorY - kind.size.h;
    void addItem({ id, kindId, x, y });
    setSelected(id);
  }

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER
        .map((cat) => [cat, furnitureByCategory(cat)] as const)
        .filter(([, items]) => items.length),
    [],
  );

  return (
    <div className="grow flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-stretch border-b border-black dark:border-white font-mono uppercase tracking-widest text-[10px]">
        <div className="px-5 py-2.5 border-r border-black dark:border-white bg-black text-white dark:bg-white dark:text-black">◇ Furnish</div>
        <div className="px-5 py-2.5 border-r border-black dark:border-white opacity-70">Drag to move · click to select</div>
        <div className="grow" />
        <button
          type="button"
          onClick={() => selected && void removeItem(selected)}
          disabled={!selected}
          className="border-l border-black dark:border-white px-5 py-2.5 flex items-center gap-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current dark:disabled:hover:bg-transparent dark:disabled:hover:text-current transition-colors"
        >
          <Trash2 size={12} /> Remove
        </button>
        <button
          type="button"
          onClick={() => void setLayout(makeStudyLayout())}
          className="border-l border-black dark:border-white px-5 py-2.5 flex items-center gap-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div className="grow grid grid-cols-[1fr_280px] min-h-0">
        {/* Stage */}
        <div className="flex items-center justify-center p-4 overflow-auto">
          <Room
            layout={layout}
            state={state}
            dark={dark}
            accent={accent}
            pet={pet}
            showGrid
            editable
            selectedId={selected}
            onSelect={setSelected}
            onMove={(id, x, y) => void moveItem(id, x, y)}
          />
        </div>

        {/* Catalog drawer */}
        <aside className="border-l border-black dark:border-white overflow-auto">
          <div className="px-4 py-3 border-b border-black dark:border-white font-mono uppercase tracking-widest text-[10px] flex justify-between">
            <span>◇ Catalog</span>
            <span className="opacity-55">{allFurniture().length} items</span>
          </div>
          {grouped.map(([cat, items]) => (
            <section key={cat} className="border-b border-black dark:border-white">
              <div className="px-4 py-2.5 font-mono uppercase tracking-widest text-[9px] opacity-55">{cat}</div>
              <div className="grid grid-cols-2">
                {items.map((it, i) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onAdd(it.id)}
                    className={[
                      "flex items-center gap-2.5 px-3 py-2.5 text-left",
                      "border-t border-black dark:border-white",
                      i % 2 === 0 ? "border-r border-black dark:border-white" : "",
                      "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors",
                    ].join(" ")}
                  >
                    <div className="w-9 h-9 shrink-0">
                      {it.render({ dark, accent, state })}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-serif font-semibold text-[13px] leading-tight">{it.name}</span>
                      <span className="font-mono uppercase tracking-widest text-[9px] opacity-70">
                        {it.price ? `◇ ${it.price}` : "free"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <div className="p-4 border-t border-black dark:border-white font-serif italic text-[12px] leading-relaxed">
            <div className="font-mono not-italic uppercase tracking-widest text-[9px] opacity-55 mb-1">For designers</div>
            New furniture appears here automatically. See <span className="font-mono text-[11px] not-italic">src/modes/home/furniture/items.tsx</span> — call <span className="font-mono text-[11px] not-italic">registerFurniture(…)</span>.
          </div>
        </aside>
      </div>
    </div>
  );
}
