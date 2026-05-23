import { open, save } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getHabitsDir, habitsFile } from "./habitsPaths";

// Versioned bundle format. Bump VERSION whenever the on-disk schema for
// any of the three files changes in a way that's not backward-compatible.
const APP_MARKER = "triptych-habits";
const VERSION = 1;

type Bundle = {
  app: typeof APP_MARKER;
  version: number;
  exportedAt: string;
  tokens: unknown;
  taskLog: unknown;
  inventory: unknown;
};

async function readJsonOrDefault(name: string, fallback: unknown): Promise<unknown> {
  const path = await habitsFile(name);
  if (!(await exists(path))) return fallback;
  try {
    const raw = await readTextFile(path);
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Writes a single JSON bundle containing all three Habits files. Returns
 *  the path written to, or null if the user cancelled the save dialog. */
export async function exportBackup(): Promise<string | null> {
  const bundle: Bundle = {
    app: APP_MARKER,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    tokens: await readJsonOrDefault("tokens.json", { tokens: 0 }),
    taskLog: await readJsonOrDefault("task_log.json", []),
    inventory: await readJsonOrDefault("inventory.json", []),
  };

  const target = await save({
    defaultPath: `triptych-habits-backup-${todayStamp()}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!target) return null;

  await writeTextFile(target, JSON.stringify(bundle, null, 2));
  return target;
}

export type ImportResult = {
  path: string;
  tokens: number;
  taskCount: number;
  inventoryCount: number;
  exportedAt: string;
};

/** Reads a bundle from a user-picked file, validates the marker+version,
 *  and overwrites the three Habits files. Throws on validation failure
 *  so the caller can surface a useful error. */
export async function importBackup(): Promise<ImportResult | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!picked || Array.isArray(picked)) return null;
  const path = picked;

  const raw = await readTextFile(path);
  let parsed: Partial<Bundle>;
  try {
    parsed = JSON.parse(raw) as Partial<Bundle>;
  } catch {
    throw new Error("File is not valid JSON.");
  }

  if (parsed.app !== APP_MARKER) {
    throw new Error(
      "Not a Triptych Habits backup (missing or wrong app marker).",
    );
  }
  if (parsed.version !== VERSION) {
    throw new Error(
      `Unsupported backup version: ${parsed.version}. This build expects version ${VERSION}.`,
    );
  }

  const taskLog = Array.isArray(parsed.taskLog) ? parsed.taskLog : [];
  const inventory = Array.isArray(parsed.inventory) ? parsed.inventory : [];
  const tokens =
    parsed.tokens && typeof parsed.tokens === "object"
      ? parsed.tokens
      : { tokens: 0 };

  // Make sure the dir exists, then write all three files. We write tokens
  // last so a crash partway through leaves the user with an honest "tokens
  // are still the old number" state rather than "balance climbed without
  // matching task log entries."
  await getHabitsDir();
  await writeTextFile(
    await habitsFile("task_log.json"),
    JSON.stringify(taskLog, null, 2),
  );
  await writeTextFile(
    await habitsFile("inventory.json"),
    JSON.stringify(inventory, null, 2),
  );
  await writeTextFile(
    await habitsFile("tokens.json"),
    JSON.stringify(tokens, null, 2),
  );

  return {
    path,
    tokens:
      typeof (tokens as { tokens?: unknown }).tokens === "number"
        ? ((tokens as { tokens: number }).tokens)
        : 0,
    taskCount: taskLog.length,
    inventoryCount: inventory.length,
    exportedAt:
      typeof parsed.exportedAt === "string" ? parsed.exportedAt : "unknown",
  };
}

/** Opens the habits data directory in the OS file browser. */
export async function revealDataFolder(): Promise<string> {
  const dir = await getHabitsDir();
  await openPath(dir);
  return dir;
}
