import { useMemo, type CSSProperties } from "react";
import {
  aggregateByDay,
  avgPerDay,
  lastNDays,
  streakDays,
  sumTokens,
  type DayCell,
  type StatEntry,
} from "./stats";

// Thresholds — see [[feedback-color-as-reward]]. Color only appears when
// the user has actually earned it through sustained effort.
export const PER_DAY_THRESHOLD = 150; // per-cell: that day's tokens to colorize cell
const TOKEN_AVG_THRESHOLD = 150; // avg tokens/day to unlock Week / Month
const STREAK_LENGTH_THRESHOLD = 7; // consecutive days to unlock Streak

// Window brand colors — only revealed when the threshold is crossed.
export const COLOR_WEEK = "#3D9970";
export const COLOR_MONTH = "#3D7BD9";
export const COLOR_STREAK = "#E48B00";

const CELL_SIZE = 32;
const CELL_GAP = 4;

type Props = {
  entries: StatEntry[];
};

// Per-cell rendering: each day's effort drives the texture inside its cell.
//   0           → empty (border only)
//   1 – 49      → sparse dots
//   50 – 99     → diagonal stripes
//   100 – 149   → dense crosshatch
//   ≥ 150       → SOLID brand color (the day hit the per-day threshold)
//
// Textures use currentColor so they invert with the theme (black on light,
// white on dark). Color only appears once the day cleared the threshold —
// that single colored cell is the dopamine signal for hitting your target
// on that specific day.
export function cellStyle(
  tokens: number,
  color: string,
  size: number = CELL_SIZE,
): CSSProperties {
  const base: CSSProperties = {
    width: size,
    height: size,
    border: "1px solid currentColor",
    boxSizing: "border-box",
    transition:
      "background 250ms ease, background-image 250ms ease, border-color 250ms ease",
  };
  if (tokens === 0) {
    return { ...base, background: "transparent" };
  }
  if (tokens >= PER_DAY_THRESHOLD) {
    return {
      ...base,
      background: color,
      borderColor: color,
    };
  }
  if (tokens < 50) {
    // Sparse dots — 4×4 grid of small dots inside the cell.
    return {
      ...base,
      backgroundImage:
        "radial-gradient(currentColor 1.2px, transparent 1.5px)",
      backgroundSize: "8px 8px",
      backgroundPosition: "center",
    };
  }
  if (tokens < 100) {
    // Diagonal stripes — 45deg.
    return {
      ...base,
      backgroundImage:
        "repeating-linear-gradient(45deg, currentColor 0px, currentColor 1.5px, transparent 1.5px, transparent 5px)",
    };
  }
  // 100 – 149: dense crosshatch
  return {
    ...base,
    backgroundImage:
      "repeating-linear-gradient(45deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 3px), " +
      "repeating-linear-gradient(-45deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 3px)",
  };
}

function CellGrid({
  cells,
  color,
  columns,
}: {
  cells: DayCell[];
  color: string;
  columns: number;
}) {
  if (cells.length === 0) {
    return (
      <div className="font-mono text-[0.6rem] opacity-40 italic">
        no activity yet
      </div>
    );
  }
  // Cells size fluidly to fill the block — `minmax(0, 1fr)` lets columns
  // shrink below their content width so the grid never bursts its parent.
  // We cap the *grid container* at CELL_SIZE × columns so wider blocks
  // (e.g. the streak when it has only a few days) don't blow each cell
  // up to a giant square. Cells stay square via aspect-ratio.
  const maxWidth = columns * CELL_SIZE + (columns - 1) * CELL_GAP;
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${CELL_GAP}px`,
        maxWidth: `${maxWidth}px`,
        width: "100%",
      }}
    >
      {cells.map((cell) => (
        <div
          key={cell.dayKey}
          style={{
            ...cellStyle(cell.tokens, color),
            width: "100%",
            height: "auto",
            aspectRatio: "1 / 1",
          }}
          title={`${cell.dayKey} · ${cell.tokens} tokens`}
        />
      ))}
    </div>
  );
}

function StatBlock({
  label,
  primary,
  secondary,
  unlocked,
  color,
  cells,
  columns,
}: {
  label: string;
  primary: string;
  secondary?: string;
  unlocked: boolean;
  color: string;
  cells: DayCell[];
  columns: number;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 border border-black dark:border-white min-w-0 overflow-hidden">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.6rem] uppercase tracking-widest opacity-70">
          {label}
        </span>
        {unlocked && (
          <span
            className="font-mono text-[0.55rem] uppercase tracking-widest font-bold"
            style={{ color }}
          >
            unlocked
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span
          className="font-mono text-2xl font-bold tabular-nums leading-none transition-colors duration-300"
          style={unlocked ? { color } : undefined}
        >
          {primary}
        </span>
        {secondary && (
          <span className="font-mono text-[0.65rem] opacity-60 tabular-nums">
            {secondary}
          </span>
        )}
      </div>
      <CellGrid cells={cells} color={color} columns={columns} />
    </div>
  );
}

export function StatsStrip({ entries }: Props) {
  // Recompute when entries change. Today is captured once per render so
  // a stale `new Date()` won't keep the strip from rolling over at
  // midnight — pages re-render on focus and on new task records, which
  // is enough granularity for this kind of feedback.
  const stats = useMemo(() => {
    const map = aggregateByDay(entries);
    const now = new Date();

    const weekCells = lastNDays(now, 7, map);
    const monthCells = lastNDays(now, 28, map);
    const streakCells = streakDays(now, map);

    const weekAvg = avgPerDay(weekCells);
    const monthAvg = avgPerDay(monthCells);

    return {
      week: {
        cells: weekCells,
        total: sumTokens(weekCells),
        avg: weekAvg,
        unlocked: weekAvg >= TOKEN_AVG_THRESHOLD,
      },
      month: {
        cells: monthCells,
        total: sumTokens(monthCells),
        avg: monthAvg,
        unlocked: monthAvg >= TOKEN_AVG_THRESHOLD,
      },
      streak: {
        cells: streakCells,
        length: streakCells.length,
        avg: avgPerDay(streakCells),
        unlocked: streakCells.length >= STREAK_LENGTH_THRESHOLD,
      },
    };
  }, [entries]);

  return (
    <div className="grid grid-cols-3 gap-3 p-4 border-b border-black dark:border-white shrink-0">
      <StatBlock
        label="This Week"
        primary={stats.week.total.toString()}
        secondary={`avg ${Math.round(stats.week.avg)}/day · need ${TOKEN_AVG_THRESHOLD}`}
        unlocked={stats.week.unlocked}
        color={COLOR_WEEK}
        cells={stats.week.cells}
        columns={7}
      />
      <StatBlock
        label="This Month (28d)"
        primary={stats.month.total.toString()}
        secondary={`avg ${Math.round(stats.month.avg)}/day · need ${TOKEN_AVG_THRESHOLD}`}
        unlocked={stats.month.unlocked}
        color={COLOR_MONTH}
        cells={stats.month.cells}
        columns={14}
      />
      <StatBlock
        label="Streak"
        primary={`${stats.streak.length} ${stats.streak.length === 1 ? "day" : "days"}`}
        secondary={`need ${STREAK_LENGTH_THRESHOLD} consecutive`}
        unlocked={stats.streak.unlocked}
        color={COLOR_STREAK}
        cells={stats.streak.cells}
        columns={Math.max(1, Math.min(stats.streak.cells.length, 14))}
      />
    </div>
  );
}
