// StatusStrip.tsx — Narrative stats row above the Room.
//
// Numbers go in the prose, not in callouts. The room itself communicates
// streak / pages / tokens through its furniture — this strip just sets
// the scene with the relevant fact for the moment.

import { useHabits } from "../../state/HabitsContext";

type Props = {
  words: number;
  pages: number;
  streak: number;
};

export function StatusStrip({ words, pages, streak }: Props) {
  const { tokens, loaded } = useHabits();
  return (
    <div className="flex items-baseline gap-3 px-6 py-2.5 border-b border-black dark:border-white">
      <span className="font-mono uppercase tracking-widest text-[10px] opacity-55">Today</span>
      <span className="font-serif italic text-sm grow opacity-90">
        You've written <b className="tabular-nums">{words.toLocaleString()}</b> words,
        turned <b className="tabular-nums">{pages}</b> pages,
        and the streak holds at <b>{streak} {streak === 1 ? "day" : "days"}</b>.
      </span>
      <span className="font-mono uppercase tracking-widest text-[11px]">
        ◇ <b className="tabular-nums">{loaded ? tokens : "—"}</b>
      </span>
    </div>
  );
}
