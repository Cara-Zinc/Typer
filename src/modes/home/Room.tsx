// Room.tsx — Side-view elevation renderer.
//
// Stateless: takes a layout, an app-state bundle, and renders. Items are
// absolutely positioned; the floor is a striped band below the floor line.
// `editable` enables drag-to-move and a dashed selection outline.
//
// Z-stacking is DOM order — items rendered later paint on top. The pet is
// rendered last so it always sits in front of furniture in its corner.

import {
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { RoomLayout } from "../../state/RoomLayoutContext";
import type { FurnitureState } from "./furniture/types";
import { getFurniture } from "./furniture";
import { ROOM_DIMENSIONS } from "./furniture/layouts";
import { PetSprite } from "../../components/PetSprite";
import type { PetMood } from "./pets";

type Props = {
  layout: RoomLayout;
  state: FurnitureState;
  dark: boolean;
  accent: string | null;
  /** Pet rendered into the corner — fixed position; not part of layout. */
  pet: {
    kindId: string;
    mood: PetMood;
    hunger: number;
    x: number;
    y: number;
    size: number;
    follow?: boolean;
  } | null;
  showGrid?: boolean;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
  /** Free-form overlay (e.g. slanted-ceiling lines in a Garret layout). */
  overlay?: ReactNode;
};

export function Room({
  layout,
  state,
  dark,
  accent,
  pet,
  showGrid = false,
  editable = false,
  selectedId,
  onSelect,
  onMove,
  overlay,
}: Props) {
  const { width, height, floorY } = ROOM_DIMENSIONS;
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  function onItemMouseDown(item: { id: string; x: number; y: number }, e: ReactMouseEvent) {
    e.stopPropagation();
    if (!editable) {
      onSelect?.(item.id);
      return;
    }
    if (!onMove) return;
    const moveItem = onMove;
    e.preventDefault();
    dragRef.current = { id: item.id, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y };
    onSelect?.(item.id);
    function onMouseMove(ev: globalThis.MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      const nextX = Math.max(0, Math.min(width - 20, d.origX + dx));
      const nextY = Math.max(0, Math.min(height - 20, d.origY + dy));
      moveItem(d.id, nextX, nextY);
    }
    function onMouseUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const hatch = dark
    ? "repeating-linear-gradient(135deg, transparent 0 11px, rgba(255,255,255,0.10) 11px 12px)"
    : "repeating-linear-gradient(135deg, transparent 0 11px, rgba(0,0,0,0.07) 11px 12px)";

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onSelect?.(null); }}
      className="relative overflow-hidden bg-white dark:bg-black text-black dark:text-white border border-black dark:border-white"
      style={{ width, height }}
    >
      {/* Floor stripe */}
      <div
        className="absolute left-0 right-0"
        style={{ top: floorY, height: height - floorY, backgroundImage: hatch }}
      />
      {/* Floor line */}
      <div className="absolute left-0 right-0 h-px bg-black dark:bg-white" style={{ top: floorY }} />
      {/* Skirting */}
      <div className="absolute left-0 right-0 opacity-40 border-b border-black dark:border-white" style={{ top: floorY - 4, height: 4 }} />

      {/* Optional grid for Furnish mode */}
      {showGrid && (
        <svg width={width} height={height} className="absolute inset-0 pointer-events-none opacity-20">
          {Array.from({ length: Math.floor(width / 40) + 1 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={height} stroke="currentColor" strokeWidth="0.5" />
          ))}
          {Array.from({ length: Math.floor(height / 40) + 1 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 40} x2={width} y2={i * 40} stroke="currentColor" strokeWidth="0.5" />
          ))}
        </svg>
      )}

      {/* Furniture */}
      {layout.items.map((item) => {
        const kind = getFurniture(item.kindId);
        if (!kind) return null;
        const sel = item.id === selectedId;
        return (
          <div
            key={item.id}
            onMouseDown={(e) => onItemMouseDown(item, e)}
            title={editable ? `${kind.name} — drag to move` : kind.name}
            className={[
              "absolute",
              editable ? "cursor-move" : "cursor-default",
              sel ? "outline outline-[1.5px] outline-dashed outline-current outline-offset-4" : "",
            ].join(" ")}
            style={{
              left: item.x,
              top: item.y,
              width: kind.size.w,
              height: kind.size.h,
              transform: item.flipped ? "scaleX(-1)" : undefined,
            }}
          >
            {kind.render({ dark, accent, state })}
          </div>
        );
      })}

      {/* Pet — rendered last so it draws on top of furniture in its corner */}
      {pet && (
        <div className="absolute z-10" style={{ left: pet.x, top: pet.y }}>
          <PetSprite
            kindId={pet.kindId}
            mood={pet.mood}
            hunger={pet.hunger}
            size={pet.size}
            dark={dark}
            color={accent}
            follow={pet.follow ?? false}
          />
        </div>
      )}

      {overlay}
    </div>
  );
}
