import { appDataDir } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";

let cachedDir: string | null = null;

// Returns the absolute path of <appDataDir>/habits, creating it if missing.
// Cached across calls so we hit the filesystem at most once per session.
export async function getHabitsDir(): Promise<string> {
  if (cachedDir) return cachedDir;
  const base = await appDataDir();
  // appDataDir() may or may not include a trailing slash depending on platform;
  // normalize by stripping it before appending.
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  const dir = `${trimmed}/habits`;
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  cachedDir = dir;
  return dir;
}

export async function habitsFile(name: string): Promise<string> {
  const dir = await getHabitsDir();
  return `${dir}/${name}`;
}
