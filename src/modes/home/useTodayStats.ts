// useTodayStats.ts — Light wrapper that derives bookshelf/fireplace inputs
// from the existing task_log.json. Pages/words aren't tracked elsewhere
// yet, so we approximate them from task descriptions tagged "Reading" /
// "Creative Work" (and let real sources replace these later).

import { useEffect, useState } from "react";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { habitsFile } from "../../state/habitsPaths";

type TaskEntry = {
  id: string;
  taskType: string;
  tokens: number;
  description: string;
  timestamp: string;
};

const TASK_LOG_FILE = "task_log.json";

export type TodayStats = {
  words: number;       // approx, from creative work entries
  pages: number;       // approx, from reading entries
  minutes: number;     // total recorded time today (rough)
  streak: number;      // consecutive days with at least one entry, ending today
  tokensToday: number; // sum of tokens earned today
  loaded: boolean;
};

const EMPTY: TodayStats = { words: 0, pages: 0, minutes: 0, streak: 0, tokensToday: 0, loaded: false };

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function streakFromEntries(entries: TaskEntry[]): number {
  // Walk back day by day; stop when a day has no entries. Inclusive of today.
  const days = new Set(entries.map((e) => new Date(e.timestamp).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useTodayStats(): TodayStats {
  const [stats, setStats] = useState<TodayStats>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const path = await habitsFile(TASK_LOG_FILE);
        if (!(await exists(path))) {
          if (!cancelled) setStats({ ...EMPTY, loaded: true });
          return;
        }
        const raw = await readTextFile(path);
        const parsed = JSON.parse(raw) as TaskEntry[];
        const today = new Date();
        const todays = parsed.filter((e) => sameDay(new Date(e.timestamp), today));
        const tokensToday = todays.reduce((acc, e) => acc + e.tokens, 0);
        // Approximations — replace with real counters as the app grows them.
        const wordsRough = todays
          .filter((e) => e.taskType === "Creative Work" || e.taskType === "Work/Study")
          .reduce((acc, e) => acc + e.tokens * 25, 0);
        const pagesRough = todays
          .filter((e) => e.taskType === "Reading")
          .reduce((acc, e) => acc + e.tokens, 0);
        const next: TodayStats = {
          words: wordsRough,
          pages: pagesRough,
          minutes: todays.length * 30, // very rough — 30 min average per task
          streak: streakFromEntries(parsed),
          tokensToday,
          loaded: true,
        };
        if (!cancelled) setStats(next);
      } catch {
        if (!cancelled) setStats({ ...EMPTY, loaded: true });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return stats;
}
