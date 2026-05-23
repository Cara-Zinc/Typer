import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Minus,
  Moon,
  Plus,
  Square,
  Sun,
  Timer,
} from "lucide-react";
import { formatReadingTime } from "./useReadingTimer";

export type SplitMode = 1 | 2;
export type ReaderTheme = "light" | "dark";

export const FONT_SCALE_MIN = 0.7;
export const FONT_SCALE_MAX = 2.0;
export const FONT_SCALE_STEP = 0.1;

type Props = {
  title: string;
  location: string;
  progress: number; // 0..1
  onPrev: () => void;
  onNext: () => void;
  onChange: () => void;
  split: SplitMode;
  onSplitToggle: () => void;
  fontScale: number;
  onFontInc: () => void;
  onFontDec: () => void;
  theme: ReaderTheme;
  onThemeToggle: () => void;
  /** Continuous reading seconds for the currently open file (owned by parent). */
  readingSeconds: number;
  children: ReactNode;
};

export function ReaderShell({
  title,
  location,
  progress,
  onPrev,
  onNext,
  onChange,
  split,
  onSplitToggle,
  fontScale,
  onFontInc,
  onFontDec,
  theme,
  onThemeToggle,
  readingSeconds,
  children,
}: Props) {
  const eyeStrain = readingSeconds >= 20 * 60; // ≥ 20 min → blink the timer as a gentle nudge.

  const rootRef = useRef<HTMLDivElement>(null);

  // Focus the shell on mount so arrow-key shortcuts work without an explicit click.
  // In split mode, both panes mount; the second mount steals focus, which is fine —
  // user can click the other pane to switch keyboard focus.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Ignore keystrokes targeted at form fields (none today, but safe for future inputs).
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onPrev();
    }
  };

  const dark = theme === "dark";
  const bg = dark ? "bg-black" : "bg-white";
  const fg = dark ? "text-white" : "text-black";
  const border = dark ? "border-white" : "border-black";
  const subtle = dark ? "text-white/60" : "text-black/60";
  const dim = dark ? "text-white/70" : "text-black/70";

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`grow flex flex-col min-h-0 outline-none ${bg} ${fg}`}
    >
      <div
        className={`flex items-center px-5 py-3 border-b font-mono text-xs uppercase tracking-[0.25em] gap-4 shrink-0 ${border}`}
      >
        <span className="truncate flex-1">{title}</span>

        <span
          className={`flex items-center gap-1 shrink-0 ${eyeStrain ? "animate-pulse font-bold" : subtle}`}
          title={
            eyeStrain
              ? "You've been reading for over 20 minutes — consider looking away for a moment."
              : "Continuous reading time"
          }
        >
          <Timer size={13} />
          <span className="tabular-nums tracking-normal">{formatReadingTime(readingSeconds)}</span>
        </span>

        <span className={`truncate flex-1 text-center ${subtle}`}>{location}</span>

        <div className="flex items-center gap-3 shrink-0">
          <div
            className={`flex items-center gap-1 border px-1.5 py-0.5 ${border}`}
            title={`Font size · ${Math.round(fontScale * 100)}%`}
          >
            <button
              onClick={onFontDec}
              disabled={fontScale <= FONT_SCALE_MIN + 1e-6}
              className="hover:opacity-70 disabled:opacity-30"
              aria-label="Decrease font size"
            >
              <Minus size={12} />
            </button>
            <span className="text-[0.65rem] tabular-nums tracking-normal w-8 text-center">
              {Math.round(fontScale * 100)}%
            </span>
            <button
              onClick={onFontInc}
              disabled={fontScale >= FONT_SCALE_MAX - 1e-6}
              className="hover:opacity-70 disabled:opacity-30"
              aria-label="Increase font size"
            >
              <Plus size={12} />
            </button>
          </div>

          <button
            onClick={onThemeToggle}
            className="hover:underline flex items-center gap-1"
            title={dark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            onClick={onSplitToggle}
            className="hover:underline flex items-center gap-1"
            title={split === 1 ? "Split into two panes" : "Close split"}
          >
            {split === 1 ? <Columns2 size={14} /> : <Square size={14} />}
            {split === 1 ? "Split" : "Unsplit"}
          </button>

          <button onClick={onChange} className="hover:underline flex items-center gap-1">
            <BookOpen size={14} /> Change
          </button>
        </div>
      </div>

      <div className="grow relative min-h-0">{children}</div>

      <div
        className={`flex justify-between items-center px-6 py-3 border-t font-mono text-sm shrink-0 ${border}`}
      >
        <button onClick={onPrev} className="flex items-center gap-1 hover:underline p-2">
          <ChevronLeft size={16} /> Prev
        </button>
        <span className={dim}>{Math.round(progress * 100)}%</span>
        <button onClick={onNext} className="flex items-center gap-1 hover:underline p-2">
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
