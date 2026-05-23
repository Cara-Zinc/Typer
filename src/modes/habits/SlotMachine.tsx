import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Coins } from "lucide-react";
import { RewardIcon } from "../../components/RewardIcon";
import { useHabits } from "../../state/HabitsContext";
import { useInventory } from "../../state/InventoryContext";
import { SHOP_REWARDS, type RewardDef } from "./rewards";

const SPIN_COST = 10;
const CYCLE_INTERVAL_MS = 80; // how fast silhouettes swap during spin
const BASE_SPIN_MS = 1400;
const STAGGER_MS = 500;
const EVAL_DELAY_MS = 200; // gap after the last reel stops before evaluating

type Phase = "idle" | "spinning" | "evaluating" | "won-3" | "won-2" | "no-win";

type ReelState = {
  /** What's currently shown in this reel's window. */
  visibleIndex: number;
  /** True while the icon should cycle on a timer. */
  spinning: boolean;
};

const POOL: RewardDef[] = SHOP_REWARDS;

// Inverse-rarity weighting: rarity 1 → 1.0, rarity 9 → 0.111. Rare rewards
// almost never land on a reel, so 3-matches on them are genuinely rare.
function pickWeighted(): number {
  const weights = POOL.map((r) => 1 / r.rarity);
  const total = weights.reduce((a, b) => a + b, 0);
  let n = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    n -= weights[i];
    if (n < 0) return i;
  }
  return POOL.length - 1;
}

function Reel({
  state,
  isWinning,
  spinning,
}: {
  state: ReelState;
  isWinning: boolean;
  spinning: boolean;
}) {
  const reward = POOL[state.visibleIndex];
  // Reveal color only when this reel is a confirmed winning slot AND the
  // overall machine is past spinning. While idle/spinning we stay strict B/W.
  const variant = isWinning ? "owned" : "shop";

  return (
    <div
      className={`relative border-2 border-black dark:border-white aspect-square flex items-center justify-center overflow-hidden bg-white dark:bg-black ${
        isWinning ? "slot-reel-win" : ""
      } ${spinning ? "slot-reel-spinning" : ""}`}
    >
      <div className="slot-reel-icon">
        <RewardIcon
          iconKey={reward.iconKey}
          variant={variant}
          color={reward.color}
          size={110}
          animateVariantChange
        />
      </div>
    </div>
  );
}

export function SlotMachine() {
  const { tokens, spend } = useHabits();
  const { acquire } = useInventory();
  const [reels, setReels] = useState<ReelState[]>(() =>
    Array.from({ length: 3 }, () => ({ visibleIndex: 0, spinning: false })),
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [winningReward, setWinningReward] = useState<RewardDef | null>(null);
  const [winningPositions, setWinningPositions] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Per-reel cycling intervals (keyed by reel index so a second spin can
  // cleanly replace the prior spin's intervals if one was somehow left
  // hanging). Timeouts are tracked in a flat list and reset each spin.
  const reelIntervalsRef = useRef<Record<number, number | undefined>>({});
  const timeoutsRef = useRef<number[]>([]);

  const clearAllTimers = useCallback(() => {
    for (const id of Object.values(reelIntervalsRef.current)) {
      if (id != null) window.clearInterval(id);
    }
    reelIntervalsRef.current = {};
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const canAfford = tokens >= SPIN_COST;
  const busy = phase === "spinning" || phase === "evaluating";

  const handleSpin = useCallback(async () => {
    if (busy || !canAfford) return;
    setError(null);
    setWinningReward(null);
    setWinningPositions([]);

    const spent = await spend(SPIN_COST);
    if (!spent) {
      setError("Could not deduct tokens.");
      return;
    }

    // Clean slate before starting — guards against any stale timers
    // (shouldn't be possible while the button is properly disabled, but
    // cheap insurance against a future code path that bypasses it).
    clearAllTimers();

    // Pick all three targets upfront. They're locked the instant SPIN is
    // pressed — the animation is purely cosmetic from here.
    const targets = [pickWeighted(), pickWeighted(), pickWeighted()];

    setPhase("spinning");
    setReels((prev) => prev.map((r) => ({ ...r, spinning: true })));

    // Each reel cycles its visible icon every CYCLE_INTERVAL_MS. We jump
    // by 1–3 positions per tick to scramble the cycle (otherwise all reels
    // would visibly tick through the pool in the same order).
    [0, 1, 2].forEach((reelIdx) => {
      const id = window.setInterval(() => {
        setReels((prev) => {
          const next = prev.slice();
          const step = 1 + Math.floor(Math.random() * 3);
          next[reelIdx] = {
            ...next[reelIdx],
            visibleIndex: (next[reelIdx].visibleIndex + step) % POOL.length,
          };
          return next;
        });
      }, CYCLE_INTERVAL_MS);
      reelIntervalsRef.current[reelIdx] = id;
    });

    // Stop each reel staggered: clear THIS reel's interval and snap to
    // its predetermined target.
    const stopOne = (reelIdx: number, delay: number) => {
      const id = window.setTimeout(() => {
        const intervalId = reelIntervalsRef.current[reelIdx];
        if (intervalId != null) {
          window.clearInterval(intervalId);
          reelIntervalsRef.current[reelIdx] = undefined;
        }
        setReels((prev) => {
          const next = prev.slice();
          next[reelIdx] = { visibleIndex: targets[reelIdx], spinning: false };
          return next;
        });
      }, delay);
      timeoutsRef.current.push(id);
    };
    stopOne(0, BASE_SPIN_MS);
    stopOne(1, BASE_SPIN_MS + STAGGER_MS);
    stopOne(2, BASE_SPIN_MS + 2 * STAGGER_MS);

    // After all reels are stopped, evaluate the result.
    const evalId = window.setTimeout(() => {
      void evaluateResult(targets);
    }, BASE_SPIN_MS + 2 * STAGGER_MS + EVAL_DELAY_MS);
    timeoutsRef.current.push(evalId);
  }, [busy, canAfford, spend, clearAllTimers]);

  const evaluateResult = useCallback(
    async (targets: number[]) => {
      setPhase("evaluating");
      // Count rewards by id across the three landing positions.
      const idAt = (i: number) => POOL[targets[i]].id;
      const counts = new Map<string, number[]>();
      for (let i = 0; i < 3; i++) {
        const id = idAt(i);
        const arr = counts.get(id) ?? [];
        arr.push(i);
        counts.set(id, arr);
      }

      let winId: string | null = null;
      let winPositions: number[] = [];
      let winQuantity = 0;
      for (const [id, positions] of counts) {
        if (positions.length === 3) {
          winId = id;
          winPositions = positions;
          winQuantity = 3;
          break;
        }
        if (positions.length === 2 && winQuantity < 1) {
          winId = id;
          winPositions = positions;
          winQuantity = 1;
        }
      }

      if (winId == null) {
        setPhase("no-win");
        return;
      }

      // Acquire the won copies into inventory. We sequence to keep the
      // write order deterministic, though InventoryContext serializes
      // internally too.
      const reward = POOL.find((r) => r.id === winId);
      if (!reward) {
        setPhase("no-win");
        return;
      }
      for (let i = 0; i < winQuantity; i++) {
        const ok = await acquire(reward.id);
        if (!ok) {
          setError("Inventory write failed — token spent but reward not added.");
          break;
        }
      }
      setWinningReward(reward);
      setWinningPositions(winPositions);
      setPhase(winQuantity === 3 ? "won-3" : "won-2");
    },
    [acquire],
  );

  const resultLine = useMemo(() => {
    if (phase === "idle") {
      return { primary: "Spin to win", secondary: null as string | null };
    }
    if (phase === "spinning" || phase === "evaluating") {
      return { primary: "Spinning…", secondary: null };
    }
    if (phase === "won-3" && winningReward) {
      return {
        primary: "★ JACKPOT ★",
        secondary: `Won 3 × ${winningReward.name}`,
      };
    }
    if (phase === "won-2" && winningReward) {
      return {
        primary: "WIN",
        secondary: `Won 1 × ${winningReward.name}`,
      };
    }
    return { primary: "Spin again", secondary: null };
  }, [phase, winningReward]);

  const buttonLabel = busy ? "…" : `Spin · ${SPIN_COST}`;
  const buttonTitle = !canAfford ? `Need ${SPIN_COST - tokens} more tokens` : undefined;

  return (
    <div className="grow flex flex-col overflow-hidden">
      <div className="p-4 border-b border-black dark:border-white font-mono uppercase text-sm tracking-widest flex justify-between items-center shrink-0">
        <span>Slot Machine</span>
        <span className="opacity-50 text-xs font-mono">
          Match 2 → win 1 · Match 3 → win 3
        </span>
      </div>

      <div className="grow overflow-y-auto p-6 flex flex-col items-center justify-start">
        <div className="w-full max-w-2xl flex flex-col items-center gap-8 py-6">
          {/* Three reels in a row */}
          <div className="grid grid-cols-3 gap-4 w-full">
            {reels.map((state, i) => (
              <Reel
                key={i}
                state={state}
                spinning={state.spinning}
                isWinning={
                  (phase === "won-2" || phase === "won-3") &&
                  winningPositions.includes(i)
                }
              />
            ))}
          </div>

          {/* Result line */}
          <div className="text-center min-h-[3.5rem] flex flex-col items-center justify-center">
            <div
              className={`font-serif font-bold tracking-wide ${
                phase === "won-3"
                  ? "text-2xl"
                  : phase === "won-2"
                    ? "text-xl"
                    : "text-base opacity-70"
              }`}
            >
              {resultLine.primary}
            </div>
            {resultLine.secondary && (
              <div className="font-serif text-sm italic mt-1 opacity-80">
                {resultLine.secondary}
              </div>
            )}
          </div>

          {/* Spin button */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={busy || !canAfford}
            title={buttonTitle}
            className="w-64 border-2 border-black dark:border-white py-3 font-mono uppercase tracking-widest text-base font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2"
          >
            <Coins size={16} /> {buttonLabel}
          </button>

          {error && (
            <div className="max-w-md border border-black dark:border-white p-3 font-mono text-xs leading-relaxed w-full">
              <span className="font-bold block mb-1">Error</span>
              {error}
            </div>
          )}

          {/* How-it-works footer */}
          <div className="border-t border-black dark:border-white pt-4 w-full text-center text-xs font-mono opacity-60 space-y-1">
            <div>Each spin costs {SPIN_COST} tokens.</div>
            <div>Rare rewards are harder to land — weighted by inverse rarity.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
