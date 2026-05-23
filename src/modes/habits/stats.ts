// Pure helpers for the Exchange stats strip. Operate on the same
// TaskEntry shape stored in task_log.json — kept structural rather than
// imported so this file has no React/Tauri dependencies.

export type StatEntry = { timestamp: string; tokens: number };

export type DayCell = { dayKey: string; tokens: number };

export type DayMap = Map<string, number>;

const SAFETY_CAP = 180; // never count a streak longer than half a year

export function dayKey(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Sum tokens per local-day. Invalid timestamps are skipped. */
export function aggregateByDay(entries: StatEntry[]): DayMap {
  const map: DayMap = new Map();
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(d);
    map.set(key, (map.get(key) ?? 0) + entry.tokens);
  }
  return map;
}

/** Last N days INCLUDING today, oldest-first. */
export function lastNDays(now: Date, n: number, map: DayMap): DayCell[] {
  const out: DayCell[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    out.push({ dayKey: k, tokens: map.get(k) ?? 0 });
  }
  return out;
}

/**
 * Days in the current streak (consecutive days with > 0 tokens, ending at
 * today). If today has no tokens yet, the streak is considered broken and
 * we return []. That makes the count "honest about today" — you can't
 * coast on yesterday's effort.
 */
export function streakDays(now: Date, map: DayMap): DayCell[] {
  const today = dayKey(now);
  if ((map.get(today) ?? 0) === 0) return [];
  const out: DayCell[] = [];
  const d = new Date(now);
  for (let i = 0; i < SAFETY_CAP; i++) {
    const k = dayKey(d);
    const tokens = map.get(k) ?? 0;
    if (tokens === 0) break;
    out.unshift({ dayKey: k, tokens });
    d.setDate(d.getDate() - 1);
  }
  return out;
}

export function sumTokens(cells: DayCell[]): number {
  return cells.reduce((sum, c) => sum + c.tokens, 0);
}

export function avgPerDay(cells: DayCell[]): number {
  if (cells.length === 0) return 0;
  return sumTokens(cells) / cells.length;
}
