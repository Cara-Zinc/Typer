import { useMemo } from "react";
import { RewardIcon } from "../../components/RewardIcon";
import { useInventory } from "../../state/InventoryContext";
import { findReward, type RewardDef } from "./rewards";
import type { InventoryRow } from "../../state/inventory";
import { formatDate } from "../../utils/date";

function RedeemedTile({
  reward,
  row,
}: {
  reward: RewardDef;
  row: InventoryRow;
}) {
  return (
    <div className="border border-black dark:border-white flex flex-col bg-white dark:bg-black">
      {/* Spent icon panel — grayscale, deeply faded. Color has been used. */}
      <div className="aspect-square border-b border-black dark:border-white flex items-center justify-center p-6 relative">
        <RewardIcon iconKey={reward.iconKey} variant="spent" size={96} />
        {row.redeemed > 1 && (
          <div className="absolute top-2 right-2 border border-black dark:border-white bg-white dark:bg-black px-2 py-0.5 font-mono text-[0.7rem] tabular-nums font-bold opacity-60">
            ×{row.redeemed}
          </div>
        )}
      </div>

      {/* Name (strikethrough) + description (also dimmed) */}
      <div className="px-4 pt-3 pb-2 flex flex-col gap-1 grow">
        <div className="font-serif text-base font-bold leading-tight line-through opacity-60">
          {reward.name}
        </div>
        <div className="font-serif text-xs italic leading-snug opacity-40">
          {reward.description}
        </div>
      </div>

      {/* Used line — no buttons. Terminal state. */}
      <div className="border-t border-black dark:border-white px-4 py-3">
        <div className="font-mono text-[0.65rem] uppercase tracking-widest opacity-60">
          Used{" "}
          {row.lastRedeemedAt ? formatDate(row.lastRedeemedAt) : "—"}
        </div>
      </div>
    </div>
  );
}

export function Redeemed() {
  const { rows, loaded } = useInventory();

  // Only rows that have at least one redeemed copy, sorted by most recent
  // redemption first. Skips rows whose catalog entry was removed.
  const redeemedTiles = useMemo(() => {
    return rows
      .filter((r) => r.redeemed > 0)
      .map((r) => ({ row: r, reward: findReward(r.rewardId) }))
      .filter(
        (t): t is { row: InventoryRow; reward: RewardDef } => t.reward != null,
      )
      .sort((a, b) => {
        const aDate = a.row.lastRedeemedAt ?? a.row.lastAcquiredAt;
        const bDate = b.row.lastRedeemedAt ?? b.row.lastAcquiredAt;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  }, [rows]);

  const totalRedeemed = useMemo(
    () => redeemedTiles.reduce((sum, t) => sum + t.row.redeemed, 0),
    [redeemedTiles],
  );

  return (
    <div className="grow flex flex-col overflow-hidden">
      <div className="p-4 border-b border-black dark:border-white font-mono uppercase text-sm tracking-widest flex justify-between items-center shrink-0">
        <span>Redeemed</span>
        <span className="opacity-50 text-xs font-mono">
          {loaded
            ? `${totalRedeemed} used · ${redeemedTiles.length} kinds`
            : "loading…"}
        </span>
      </div>

      <div className="grow overflow-y-auto p-6">
        {redeemedTiles.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-md border border-black dark:border-white p-8 text-center">
              <div className="font-serif text-xl mb-2">Nothing redeemed yet</div>
              <p className="font-serif text-sm leading-relaxed opacity-70">
                Rewards you redeem from{" "}
                <span className="font-mono uppercase">Owned</span> come to rest
                here. They become quiet records of color you've already spent.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {redeemedTiles.map(({ row, reward }) => (
              <RedeemedTile key={reward.id} reward={reward} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
