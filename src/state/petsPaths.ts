import { appDataDir } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";

// Resolves to <appDataDir>/pets, creating it if missing. Cached for the
// session — we hit the filesystem at most once per launch. Mirrors
// habitsPaths.ts so storage layout stays predictable across subsystems.

let cachedDir: string | null = null;

export async function getPetsDir(): Promise<string> {
  if (cachedDir) return cachedDir;
  const base = await appDataDir();
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  const dir = `${trimmed}/pets`;
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  cachedDir = dir;
  return dir;
}

export async function petsFile(name: string): Promise<string> {
  const dir = await getPetsDir();
  return `${dir}/${name}`;
}
