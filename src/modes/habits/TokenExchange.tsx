import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { habitsFile } from "../../state/habitsPaths";
import { useHabits } from "../../state/HabitsContext";
import { StatsStrip } from "./StatsStrip";

type TaskType =
  | "Exercise"
  | "Work/Study"
  | "Reading"
  | "Meditation"
  | "Healthy Habit"
  | "Creative Work"
  | "Custom";

type TaskTypeDef = {
  description: string;
  min: number;
  max: number;
  default: number;
};

const TASK_TYPES: Record<TaskType, TaskTypeDef> = {
  Exercise: {
    description: "Physical activities like workout, jogging, yoga.",
    min: 10,
    max: 50,
    default: 20,
  },
  "Work/Study": {
    description: "Completing work tasks or study sessions.",
    min: 5,
    max: 100,
    default: 25,
  },
  Reading: {
    description: "Reading books, articles, or papers.",
    min: 5,
    max: 30,
    default: 15,
  },
  Meditation: {
    description: "Mindfulness and meditation sessions.",
    min: 5,
    max: 20,
    default: 10,
  },
  "Healthy Habit": {
    description: "Drinking water, eating healthy, etc.",
    min: 2,
    max: 15,
    default: 5,
  },
  "Creative Work": {
    description: "Art, music, writing, or other creative pursuits.",
    min: 10,
    max: 40,
    default: 20,
  },
  Custom: {
    description: "Define your own task.",
    min: 1,
    max: 100,
    default: 10,
  },
};

const TASK_TYPE_ORDER: TaskType[] = [
  "Exercise",
  "Work/Study",
  "Reading",
  "Meditation",
  "Healthy Habit",
  "Creative Work",
  "Custom",
];

type TaskEntry = {
  id: string;
  taskType: TaskType;
  tokens: number;
  description: string;
  timestamp: string;
};

const TASK_LOG_FILE = "task_log.json";

async function readTaskLog(): Promise<TaskEntry[]> {
  const path = await habitsFile(TASK_LOG_FILE);
  if (!(await exists(path))) return [];
  try {
    const raw = await readTextFile(path);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TaskEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeTaskLog(entries: TaskEntry[]): Promise<void> {
  const path = await habitsFile(TASK_LOG_FILE);
  await writeTextFile(path, JSON.stringify(entries, null, 2));
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function TokenExchange() {
  const { add } = useHabits();
  const [taskType, setTaskType] = useState<TaskType>("Exercise");
  const [description, setDescription] = useState("");
  const [tokenAmount, setTokenAmount] = useState(TASK_TYPES.Exercise.default);
  const [history, setHistory] = useState<TaskEntry[]>([]);
  const [logLoaded, setLogLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const def = TASK_TYPES[taskType];

  useEffect(() => {
    void (async () => {
      try {
        setHistory(await readTaskLog());
      } catch {
        setHistory([]);
      }
      setLogLoaded(true);
    })();
  }, []);

  // Keep tokenAmount inside the current task type's range, and snap to its
  // default each time the type changes — matches the PyQt original UX.
  useEffect(() => {
    setTokenAmount(def.default);
  }, [taskType, def.default]);

  const adjustTokens = useCallback(
    (delta: number) => {
      setTokenAmount((t) => clamp(t + delta, def.min, def.max));
    },
    [def.min, def.max],
  );

  const handleSubmit = useCallback(async () => {
    setError(null);
    const desc = description.trim();
    if (!desc) {
      setError("Description required.");
      return;
    }
    const amount = clamp(tokenAmount, def.min, def.max);
    setSubmitting(true);
    try {
      const ok = await add(amount);
      if (!ok) {
        setError("Could not add tokens. Check storage.");
        return;
      }
      const entry: TaskEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskType,
        tokens: amount,
        description: desc,
        timestamp: new Date().toISOString(),
      };
      const next = [entry, ...history];
      setHistory(next);
      try {
        await writeTaskLog(next);
      } catch (e) {
        // Tokens already added; surface the log write error but don't roll back.
        setError(`Task logged but file write failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      setDescription("");
      setFlash(`+${amount} tokens`);
      window.setTimeout(() => setFlash(null), 1400);
    } finally {
      setSubmitting(false);
    }
  }, [add, def.min, def.max, description, history, taskType, tokenAmount]);

  const submitLabel = useMemo(
    () => `Record · Earn ${tokenAmount}`,
    [tokenAmount],
  );

  return (
    <div className="grow flex flex-col h-full overflow-hidden">
      {/* Stats strip — color appears here when daily-average / streak
          thresholds are crossed. See [[feedback-color-as-reward]]. */}
      <StatsStrip entries={history} />

      <div className="grow flex min-h-0 overflow-hidden">
      {/* Left: record form */}
      <div className="w-2/5 border-r border-black dark:border-white flex flex-col">
        <div className="p-4 bg-black text-white dark:bg-white dark:text-black font-mono uppercase text-sm tracking-widest shrink-0">
          Record Completed Task
        </div>
        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Task type select */}
          <label className="flex flex-col gap-2">
            <span className="font-mono uppercase text-[0.65rem] tracking-widest opacity-70">
              Task Type
            </span>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
              className="appearance-none border border-black dark:border-white bg-white dark:bg-black px-3 py-2 font-serif text-base focus:outline-none focus:bg-black focus:text-white dark:focus:bg-white dark:focus:text-black"
            >
              {TASK_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="font-serif text-xs italic opacity-70">
              {def.description}
            </span>
          </label>

          {/* Description textarea */}
          <label className="flex flex-col gap-2">
            <span className="font-mono uppercase text-[0.65rem] tracking-widest opacity-70">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ran 5km · Finished chapter 3"
              className="border border-black dark:border-white bg-white dark:bg-black px-3 py-2 font-serif text-base min-h-[100px] resize-y focus:outline-none placeholder:opacity-40"
            />
          </label>

          {/* Token spinner */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-mono uppercase text-[0.65rem] tracking-widest opacity-70">
              <span>Tokens</span>
              <span>
                {def.min}–{def.max}
              </span>
            </div>
            <div className="flex items-stretch border border-black dark:border-white">
              <button
                type="button"
                onClick={() => adjustTokens(-1)}
                disabled={tokenAmount <= def.min}
                className="px-4 border-r border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Decrease tokens"
              >
                <Minus size={14} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={tokenAmount}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                  if (Number.isFinite(n)) setTokenAmount(clamp(n, def.min, def.max));
                  else setTokenAmount(def.min);
                }}
                className="grow text-center font-mono text-lg font-bold tabular-nums bg-white dark:bg-black focus:outline-none"
              />
              <button
                type="button"
                onClick={() => adjustTokens(1)}
                disabled={tokenAmount >= def.max}
                className="px-4 border-l border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Increase tokens"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="w-full border-2 border-black dark:border-white py-3 font-mono uppercase tracking-widest text-sm font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
          >
            {submitting ? "Recording…" : submitLabel}
          </button>

          {error && (
            <div className="border border-black dark:border-white p-3 font-mono text-xs leading-relaxed">
              <span className="font-bold block mb-1">Error</span>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Right: task history */}
      <div className="w-3/5 flex flex-col">
        <div className="p-4 border-b border-black dark:border-white font-mono uppercase text-sm tracking-widest flex justify-between items-center shrink-0">
          <span>Task History</span>
          <span className="opacity-50 text-xs">
            {logLoaded ? `${history.length} entries` : "loading…"}
          </span>
        </div>
        <div className="grow overflow-y-auto">
          {history.length === 0 ? (
            <div className="h-full flex items-center justify-center p-10">
              <div className="font-serif text-sm opacity-50 italic text-center max-w-xs">
                {logLoaded
                  ? "No tasks recorded yet. Earn your first tokens on the left."
                  : "Loading task history…"}
              </div>
            </div>
          ) : (
            <ul>
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="border-b border-black dark:border-white px-5 py-4 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-baseline font-mono text-[0.65rem] tracking-widest uppercase opacity-70">
                    <span>{entry.taskType}</span>
                    <span>{formatTimestamp(entry.timestamp)}</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-lg font-bold tabular-nums shrink-0">
                      +{entry.tokens}
                    </span>
                    <span className="font-serif text-sm leading-snug">
                      {entry.description}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </div>{/* /inner row */}

      {/* Flash toast on successful record */}
      {flash && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 border border-black dark:border-white bg-white dark:bg-black px-5 py-2 font-mono uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          {flash}
        </div>
      )}
    </div>
  );
}
