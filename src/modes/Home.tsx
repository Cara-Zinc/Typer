// Home.tsx — Top-level Home mode.
//
// First-run flow:
//   1. PetContext loaded? if not → loading splash
//   2. pet === null → <Onboarding />  (MBTI quiz → adopt)
//   3. else → Study view (Room with pet in the corner)
//
// View modes (toggle in top bar):
//   - 'study'    : the room, primary
//   - 'furnish'  : drag + catalog drawer
//   - 'briefing' : terminal-style stats — power-user view, kept from V3
//
// Stats flow into FurnitureState so each piece can reflect them
// (bookshelf books, fireplace flame, window time-of-day, clock hands,
// plant size). Numbers themselves are not displayed as callouts; the
// room IS the dashboard.

import { useMemo, useState, type ReactNode } from "react";
import { Home as HomeIcon, Hammer, Terminal } from "lucide-react";
import { usePet } from "../state/PetContext";
import { useHabits } from "../state/HabitsContext";
import { useTheme } from "../state/ThemeContext";
import { Room } from "./home/Room";
import { RoomEditor } from "./home/RoomEditor";
import { Onboarding } from "./home/Onboarding";
import { PetBubble } from "./home/PetBubble";
import { StatusStrip } from "./home/StatusStrip";
import { useRotatingTip } from "./home/tips";
import { useDayPhase } from "./home/dayPhase";
import { useTodayStats } from "./home/useTodayStats";
import { useRoomLayout } from "../state/RoomLayoutContext";
import { ROOM_DIMENSIONS } from "./home/furniture/layouts";
import type { FurnitureState } from "./home/furniture/types";
import { PetSprite } from "../components/PetSprite";

type View = "study" | "furnish" | "briefing";

type Props = {
  /** Triggered by the Resume strip at the bottom. */
  onNavigate?: (target: "read" | "write" | "edit" | "archive" | "habits") => void;
};

export function Home({ onNavigate }: Props) {
  const { pet, loaded } = usePet();
  const { dark } = useTheme();
  const [view, setView] = useState<View>("study");

  if (!loaded) {
    return (
      <div className="grow flex items-center justify-center bg-white dark:bg-black text-black dark:text-white font-mono uppercase tracking-widest text-xs opacity-55">
        Loading…
      </div>
    );
  }
  if (!pet) {
    return <Onboarding dark={dark} />;
  }

  return (
    <div className="grow flex flex-col bg-white dark:bg-black text-black dark:text-white overflow-hidden">
      <ViewSwitch view={view} setView={setView} petName={pet.name} />
      {view === "study" && <StudyView pet={pet} dark={dark} onNavigate={onNavigate} />}
      {view === "furnish" && <FurnishView pet={pet} dark={dark} />}
      {view === "briefing" && <BriefingView pet={pet} />}
    </div>
  );
}

function ViewSwitch({ view, setView, petName }: { view: View; setView: (v: View) => void; petName: string }) {
  const items: Array<{ id: View; label: string; icon: ReactNode }> = [
    { id: "study",    label: "Study",     icon: <HomeIcon size={12} /> },
    { id: "furnish",  label: "Furnish",   icon: <Hammer size={12} /> },
    { id: "briefing", label: "Briefing",  icon: <Terminal size={12} /> },
  ];
  return (
    <div className="flex items-stretch border-b border-black dark:border-white shrink-0">
      {items.map((it, i) => (
        <button
          key={it.id}
          type="button"
          onClick={() => setView(it.id)}
          className={[
            "px-5 py-2 flex items-center gap-2 font-mono uppercase tracking-widest text-[11px] transition-colors",
            i > 0 ? "border-l border-black dark:border-white" : "",
            view === it.id
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black",
          ].join(" ")}
        >
          {it.icon}<span>{it.label}</span>
        </button>
      ))}
      <div className="grow" />
      <div className="px-5 py-2 font-mono uppercase tracking-widest text-[10px] opacity-55 flex items-center border-l border-black dark:border-white">
        ◇ {petName}
      </div>
    </div>
  );
}

function buildState(stats: ReturnType<typeof useTodayStats>, phase: ReturnType<typeof useDayPhase>): FurnitureState {
  return {
    time: phase.now,
    dayPhase: phase.phase,
    streak: stats.streak,
    pagesRead: stats.pages,
    words: stats.words,
    tokensToday: stats.tokensToday,
    quote: { author: "Kafka" },
  };
}

// ─── Study view ──────────────────────────────────────────────────────────

function StudyView({ pet, dark, onNavigate }: { pet: NonNullable<ReturnType<typeof usePet>["pet"]>; dark: boolean; onNavigate?: Props["onNavigate"] }) {
  const stats = useTodayStats();
  const phase = useDayPhase();
  const { layout } = useRoomLayout();
  const tip = useRotatingTip();
  const state = useMemo(() => buildState(stats, phase), [stats, phase]);
  const { tokens } = useHabits();

  const petCorner = useMemo(() => {
    // Pet sits in the bottom-right of the room. If a pet bed exists in the
    // layout, perch the pet on it; otherwise default to a fixed corner.
    const bed = layout.items.find((it) => it.kindId === "petbed");
    if (bed) return { x: bed.x + 38, y: bed.y - 50 };
    return { x: 920, y: ROOM_DIMENSIONS.floorY - 80 };
  }, [layout.items]);

  return (
    <>
      <StatusStrip words={stats.words} pages={stats.pages} streak={stats.streak} />
      <div className="grow flex items-center justify-center p-6 relative overflow-hidden">
        <div className="relative">
          <Room
            layout={layout}
            state={state}
            dark={dark}
            accent={null}
            pet={{
              kindId: pet.kindId,
              mood: pet.mood,
              hunger: pet.hunger,
              x: petCorner.x,
              y: petCorner.y,
              size: 66,
              follow: true,
            }}
          />
          <div className="absolute" style={{ left: petCorner.x - 240, top: petCorner.y - 50, pointerEvents: "none" }}>
            <PetBubble side="right" font="serif">{tip}</PetBubble>
          </div>
        </div>
      </div>
      {/* Resume strip — gentle prompts back into the other modes */}
      <div className="flex border-t border-black dark:border-white">
        {(
          [
            { to: "read"   as const, label: "Reading Table", note: "page 87 of The Magic Mountain" },
            { to: "write"  as const, label: "Typer",         note: "Chapter 12 — The Sanatorium" },
            { to: "habits" as const, label: "Habits · Pet",  note: `${tokens} tokens · feed ${pet.name}` },
          ]
        ).map((c, i, a) => (
          <button
            key={c.to}
            type="button"
            onClick={() => onNavigate?.(c.to)}
            className={[
              "flex-1 px-5 py-3.5 text-left flex flex-col gap-1",
              i < a.length - 1 ? "border-r border-black dark:border-white" : "",
              "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors",
            ].join(" ")}
          >
            <span className="font-mono uppercase tracking-widest text-[10px] opacity-65">Resume → {c.label}</span>
            <span className="font-serif italic">{c.note}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ─── Furnish view ────────────────────────────────────────────────────────

function FurnishView({ pet, dark }: { pet: NonNullable<ReturnType<typeof usePet>["pet"]>; dark: boolean }) {
  const stats = useTodayStats();
  const phase = useDayPhase();
  const state = useMemo(() => buildState(stats, phase), [stats, phase]);
  return (
    <RoomEditor
      state={state}
      dark={dark}
      accent={null}
      pet={{
        kindId: pet.kindId,
        mood: pet.mood,
        hunger: pet.hunger,
        x: 920,
        y: ROOM_DIMENSIONS.floorY - 80,
        size: 66,
      }}
    />
  );
}

// ─── Briefing view (terminal) ────────────────────────────────────────────

function BriefingView({ pet }: { pet: NonNullable<ReturnType<typeof usePet>["pet"]> }) {
  const stats = useTodayStats();
  const tip = useRotatingTip();
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <div className="grow p-8 px-12 flex flex-col gap-3.5 font-mono text-[13px] leading-snug overflow-hidden">
      <div className="opacity-60 text-[11px] uppercase tracking-widest">
        triptych ~ briefing · {dateStr} · {timeStr}
      </div>
      <div className="border-b border-dashed border-black dark:border-white opacity-50" />
      <div className="grid grid-cols-2 gap-12 grow min-h-0">
        <div className="flex flex-col gap-3.5">
          <pre className="m-0 leading-relaxed">
{`◇ today
  words written ........... ${String(stats.words).padStart(6)}
  pages read .............. ${String(stats.pages).padStart(6)}
  read time ............... ${String(`${Math.floor(stats.minutes/60)}h ${stats.minutes%60}m`).padStart(6)}
  streak .................. ${String(`${stats.streak}d`).padStart(6)}
  tokens today ............ ${String(stats.tokensToday).padStart(6)}`}
          </pre>
          <pre className="m-0 leading-relaxed italic">
{`◇ companion
  ${pet.name} (${pet.kindId})
  hunger ............. ${String(Math.round(pet.hunger) + "%").padStart(6)}
  mood ............... ${String(pet.mood).padStart(8)}`}
          </pre>
        </div>
        <div className="flex flex-col items-center justify-center gap-5">
          <div className="opacity-50 text-[10px] uppercase tracking-widest self-start">◇ companion · {pet.name}</div>
          <PetSprite kindId={pet.kindId} mood={pet.mood} hunger={pet.hunger} size={200} follow />
          <div className="self-stretch">
            <PetBubble font="mono">{tip}</PetBubble>
          </div>
        </div>
      </div>
      <div className="border-t border-dashed border-black dark:border-white pt-3 flex gap-2.5">
        <span className="font-bold">$</span>
        <span className="opacity-60">type a tab name or </span>
        <span className="border-b border-black dark:border-white pb-px animate-pulse">_</span>
      </div>
    </div>
  );
}
