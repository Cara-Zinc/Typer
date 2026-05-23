import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { habitsFile } from "./habitsPaths";

// Inventory model: one row per reward kind, with stacked owned/redeemed
// counts. Quantity stacking keeps the trophy case visually compact (one
// tile per reward) while still letting us show "x3" badges. Redeemed
// items count is terminal — there's no path back from redeemed → owned.
export type InventoryRow = {
  rewardId: string;
  owned: number;
  redeemed: number;
  firstAcquiredAt: string;
  lastAcquiredAt: string;
  lastRedeemedAt?: string;
};

const FILE = "inventory.json";

export async function readInventory(): Promise<InventoryRow[]> {
  const path = await habitsFile(FILE);
  if (!(await exists(path))) return [];
  try {
    const raw = await readTextFile(path);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InventoryRow[]) : [];
  } catch {
    return [];
  }
}

export async function writeInventory(rows: InventoryRow[]): Promise<void> {
  const path = await habitsFile(FILE);
  await writeTextFile(path, JSON.stringify(rows, null, 2));
}

// Bumps owned count for `rewardId` by 1. Creates a fresh row if the
// reward has never been acquired before. Returns the resulting row.
export function acquire(
  rows: InventoryRow[],
  rewardId: string,
): { rows: InventoryRow[]; row: InventoryRow } {
  const now = new Date().toISOString();
  const idx = rows.findIndex((r) => r.rewardId === rewardId);
  if (idx === -1) {
    const row: InventoryRow = {
      rewardId,
      owned: 1,
      redeemed: 0,
      firstAcquiredAt: now,
      lastAcquiredAt: now,
    };
    return { rows: [...rows, row], row };
  }
  const existing = rows[idx];
  const updated: InventoryRow = {
    ...existing,
    owned: existing.owned + 1,
    lastAcquiredAt: now,
  };
  const next = rows.slice();
  next[idx] = updated;
  return { rows: next, row: updated };
}

// Moves 1 owned → 1 redeemed for `rewardId`. Returns null if there's
// nothing left to redeem.
export function redeem(
  rows: InventoryRow[],
  rewardId: string,
): { rows: InventoryRow[]; row: InventoryRow } | null {
  const now = new Date().toISOString();
  const idx = rows.findIndex((r) => r.rewardId === rewardId);
  if (idx === -1) return null;
  const existing = rows[idx];
  if (existing.owned <= 0) return null;
  const updated: InventoryRow = {
    ...existing,
    owned: existing.owned - 1,
    redeemed: existing.redeemed + 1,
    lastRedeemedAt: now,
  };
  const next = rows.slice();
  next[idx] = updated;
  return { rows: next, row: updated };
}
