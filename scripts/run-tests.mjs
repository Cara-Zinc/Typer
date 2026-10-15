import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Enumerate explicitly: shell ** globs do not recurse consistently across OSes.
const root = fileURLToPath(new URL("../", import.meta.url));
function findTests(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findTests(path) : /\.test\.(?:ts|cjs|mjs)$/.test(entry.name) ? [path] : [];
  });
}
const files = ["src", "tests"].filter((directory) => existsSync(join(root, directory)))
  .flatMap(findTests).sort();
if (!files.length) throw new Error("No test files found under src or tests");
console.log(`Running ${files.length} test files: ${files.join(", ")}`);
const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...files], {
  cwd: root,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
