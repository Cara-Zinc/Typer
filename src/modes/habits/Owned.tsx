import { useCallback, useMemo, useState } from "react";
import { RewardIcon } from "../../components/RewardIcon";
import { useInventory } from "../../state/InventoryContext";
import { findReward, type RewardDef } from "./rewards";
import type { InventoryRow } from "../../state/inventory";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function OwnedTile({
  reward,
  row,
  busy,
  pendingConfirm,
  onRequestConfirm,
  onCancelConfirm,
  onRedeem,
}: {
  reward: RewardDef;
  row: InventoryRow;
  busy: boolean;
  pendingConfirm: boolean;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
  onRedeem: () => void;
}) {
  return (
    <div className="border border-black dark:border-white flex flex-col bg-white dark:bg-black">
      {/* Color panel — the ONLY place color is allowed to live. */}
      <div className="aspect-square border-b border-black dark:border-white flex items-center justify-center p-6 relative">
        <RewardIcon
          iconKey={reward.iconKey}
          variant="owned"
          color={reward.color}
          size={96}
        />
        {row.owned > 1 && (
          <div className="absolute top-2 right-2 border border-black dark:border-white bg-white dark:bg-black px-2 py-0.5 font-mono text-[0.7rem] tabular-nums font-bold">
            ×{row.owned}
          </div>
        )}
      </div>

      {/* Name + description */}
      <div className="px-4 pt-3 pb-2 flex flex-col gap-1 grow">
        <div className="font-serif text-base font-bold leading-tight">
          {reward.name}
        </div>
        <div className="font-serif text-xs italic leading-snug opacity-70">
          {reward.description}
        </div>
      </div>

      {/* Earned line + redeem button (two-step confirm) */}
      <div className="border-t border-black dark:border-white px-4 py-3 flex flex-col gap-2">
        <div className="font-mono text-[0.65rem] uppercase tracking-widest opacity-60">
          Earned {formatDate(row.lastAcquiredAt)}
        </div>
        {pendingConfirm ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRedeem}
              disabled={busy}
              className="grow border border-black dark:border-white px-3 py-1.5 font-mono uppercase tracking-widest text-xs font-bold bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {busy ? "…" : "Confirm — irreversible"}
            </button>
            <button
              type="button"
              onClick={onCancelConfirm}
              className="border border-black dark:border-white px-3 py-1.5 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRequestConfirm}
            className="border border-black dark:border-white px-3 py-1.5 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
          >
            Redeem
          </button>
        )}
      </div>
    </div>
  );
}

export function Owned() {
  const { rows, redeem, loaded } = useInventory();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Owned tiles: rows with at least one unredeemed item, newest-first.
  // We resolve each row's reward def lazily so deleted catalog entries
  // (shouldn't happen in this app, but safe) just drop out.
  const ownedTiles = useMemo(() => {
    return rows
      .filter((r) => r.owned > 0)
      .map((r) => ({ row: r, reward: findReward(r.rewardId) }))
      .filter(
        (t): t is { row: InventoryRow; reward: RewardDef } => t.reward != null,
      )
      .sort(
        (a, b) =>
          new Date(b.row.lastAcquiredAt).getTime() -
          new Date(a.row.lastAcquiredAt).getTime(),
      );
  }, [rows]);

  const handleRedeem = useCallback(
    async (rewardId: string, rewardName: string) => {
      setError(null);
      setBusyId(rewardId);
      try {
        const row = await redeem(rewardId);
        if (!row) {
          setError(`Could not redeem ${rewardName}.`);
          return;
        }
        setFlash(`Redeemed · ${rewardName}`);
        window.setTimeout(() => setFlash(null), 1400);
      } finally {
        setBusyId(null);
        setConfirmId(null);
      }
    },
    [redeem],
  );

  return (
    <div className="grow flex flex-col overflow-hidden">
      <div className="p-4 border-b border-black dark:border-white font-mono uppercase text-sm tracking-widest flex justify-between items-center shrink-0">
        <span>Owned</span>
        <span className="opacity-50 text-xs font-mono">
          {loaded ? `${ownedTiles.length} rewards` : "loading…"}
        </span>
      </div>

      <div className="grow overflow-y-auto p-6">
        {ownedTiles.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-md border border-black dark:border-white p-8 text-center">
              <div className="font-serif text-xl mb-2">Empty trophy case</div>
              <p className="font-serif text-sm leading-relaxed opacity-70">
                Earn tokens in <span className="font-mono uppercase">Exchange</span>,
                then trade them in <span className="font-mono uppercase">Shop</span> or{" "}
                <span className="font-mono uppercase">Slot</span> to fill this space
                with color.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {ownedTiles.map(({ row, reward }) => (
              <OwnedTile
                key={reward.id}
                reward={reward}
                row={row}
                busy={busyId === reward.id}
                pendingConfirm={confirmId === reward.id}
                onRequestConfirm={() => setConfirmId(reward.id)}
                onCancelConfirm={() =>
                  setConfirmId((id) => (id === reward.id ? null : id))
                }
                onRedeem={() => handleRedeem(reward.id, reward.name)}
              />
            ))}
          </div>
        )}

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
