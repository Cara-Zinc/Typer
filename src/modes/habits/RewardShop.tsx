import { useCallback, useState } from "react";
import { Coins } from "lucide-react";
import { RewardIcon } from "../../components/RewardIcon";
import { useHabits } from "../../state/HabitsContext";
import { useInventory } from "../../state/InventoryContext";
import { SHOP_REWARDS, priceOf, type RewardDef } from "./rewards";

function ShopTile({
  reward,
  ownedCount,
  tokens,
  busy,
  onBuy,
}: {
  reward: RewardDef;
  ownedCount: number;
  tokens: number;
  busy: boolean;
  onBuy: (r: RewardDef) => void;
}) {
  const price = priceOf(reward);
  const canAfford = tokens >= price;
  return (
    <div className="border border-black dark:border-white flex flex-col bg-white dark:bg-black">
      {/* Icon panel — square, separated by 1px line from text below */}
      <div className="aspect-square border-b border-black dark:border-white flex items-center justify-center p-6 relative">
        <RewardIcon iconKey={reward.iconKey} variant="shop" size={96} />
        {ownedCount > 0 && (
          <div
            className="absolute top-2 right-2 border border-black dark:border-white bg-white dark:bg-black px-2 py-0.5 font-mono text-[0.65rem] tracking-widest uppercase"
            title={`You own ${ownedCount} of this reward`}
          >
            Owned · {ownedCount}
          </div>
        )}
      </div>

      {/* Name + description + rarity badge */}
      <div className="px-4 pt-3 pb-2 flex flex-col gap-1 grow">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-serif text-base font-bold leading-tight">
            {reward.name}
          </div>
          <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 shrink-0">
            R{reward.rarity}
          </div>
        </div>
        <div className="font-serif text-xs italic leading-snug opacity-70">
          {reward.description}
        </div>
      </div>

      {/* Price + Buy */}
      <div className="border-t border-black dark:border-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="font-mono text-sm flex items-center gap-1.5">
          <Coins size={14} />
          <span className="font-bold tabular-nums">{price}</span>
        </div>
        <button
          type="button"
          onClick={() => onBuy(reward)}
          disabled={!canAfford || busy}
          title={!canAfford ? `Need ${price - tokens} more tokens` : undefined}
          className="border border-black dark:border-white px-4 py-1.5 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current dark:disabled:hover:bg-transparent dark:disabled:hover:text-current"
        >
          {busy ? "…" : "Buy"}
        </button>
      </div>
    </div>
  );
}

export function RewardShop() {
  const { tokens, spend } = useHabits();
  const { rows, acquire } = useInventory();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ownedCount = useCallback(
    (rewardId: string) => rows.find((r) => r.rewardId === rewardId)?.owned ?? 0,
    [rows],
  );

  const handleBuy = useCallback(
    async (reward: RewardDef) => {
      setError(null);
      const price = priceOf(reward);
      setBusyId(reward.id);
      try {
        const spent = await spend(price);
        if (!spent) {
          setError(`Not enough tokens for ${reward.name}.`);
          return;
        }
        const row = await acquire(reward.id);
        if (!row) {
          // Inventory write failed but tokens are already gone. Surface it
          // so the user can see what happened; we don't try to refund.
          setError(`Tokens spent but inventory write failed for ${reward.name}.`);
          return;
        }
        setFlash(`+1 ${reward.name}`);
        window.setTimeout(() => setFlash(null), 1400);
      } finally {
        setBusyId(null);
      }
    },
    [acquire, spend],
  );

  return (
    <div className="grow flex flex-col overflow-hidden">
      <div className="p-4 border-b border-black dark:border-white font-mono uppercase text-sm tracking-widest flex justify-between items-center shrink-0">
        <span>Reward Shop</span>
        <span className="opacity-50 text-xs font-mono">
          Price = 30 × rarity
        </span>
      </div>

      <div className="grow overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {SHOP_REWARDS.map((reward) => (
            <ShopTile
              key={reward.id}
              reward={reward}
              ownedCount={ownedCount(reward.id)}
              tokens={tokens}
              busy={busyId === reward.id}
              onBuy={handleBuy}
            />
          ))}
        </div>

        {error && (
          <div className="max-w-md mx-auto mt-6 border border-black dark:border-white p-3 font-mono text-xs leading-relaxed">
            <span className="font-bold block mb-1">Error</span>
            {error}
          </div>
        )}
      </div>

      {flash && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 border border-black dark:border-white bg-white dark:bg-black px-5 py-2 font-mono uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          {flash}
        </div>
      )}
    </div>
  );
}
