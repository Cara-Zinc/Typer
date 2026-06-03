import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, exists, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  HardDrive,
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Clock,
  X,
} from "lucide-react";
import { classifyPath } from "./readers/formats";
import type { ReaderOpenRequest } from "./readers/readerTypes";

type TreeNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  children?: TreeNode[]; // undefined = not yet loaded
  expanded: boolean;
  loading: boolean;
};

const EBOOK_EXTS = new Set(["epub", "pdf", "mobi", "azw3", "txt", "md"]);
const VAULT_PREF_KEY = "triptych.archiver.vaultPath";
const VAULT_HISTORY_KEY = "triptych.archiver.vaultHistory";
const VAULT_HISTORY_MAX = 3;

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(VAULT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string").slice(0, VAULT_HISTORY_MAX);
  } catch {
    return [];
  }
}

function writeHistory(items: string[]) {
  try {
    localStorage.setItem(VAULT_HISTORY_KEY, JSON.stringify(items.slice(0, VAULT_HISTORY_MAX)));
  } catch {
    /* ignore */
  }
}

function makeNode(name: string, path: string, type: "directory" | "file"): TreeNode {
  return { name, path, type, expanded: false, loading: false };
}

async function ensureVault(rootPath: string) {
  const vaultDir = `${rootPath}/.triptych`;
  const vaultFile = `${vaultDir}/vault.json`;
  if (!(await exists(vaultDir))) {
    await mkdir(vaultDir, { recursive: true });
  }
  if (!(await exists(vaultFile))) {
    const initial = {
      version: 1,
      createdAt: new Date().toISOString(),
      rootPath,
      bookmarks: {},
      recentFiles: [],
    };
    await writeTextFile(vaultFile, JSON.stringify(initial, null, 2));
  }
}

async function loadChildren(path: string): Promise<TreeNode[]> {
  const entries = await readDir(path);
  const kids = entries
    // Skip the vault dir + macOS metadata noise. Hidden dotfiles stay hidden.
    .filter((e) => e.name !== ".triptych" && !e.name.startsWith("."))
    .map((e) =>
      makeNode(e.name, `${path}/${e.name}`, e.isDirectory ? "directory" : "file"),
    );
  kids.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "directory" ? -1 : 1;
  });
  return kids;
}

// Pure recursive update — find the node at `targetPath` and run `update` on it.
function updateNode(
  node: TreeNode,
  targetPath: string,
  update: (n: TreeNode) => TreeNode,
): TreeNode {
  if (node.path === targetPath) return update(node);
  if (!node.children) return node;
  return { ...node, children: node.children.map((c) => updateNode(c, targetPath, update)) };
}

type Props = {
  /** Called when the user clicks a file with a Reader-supported format. */
  onOpenFile?: (request: ReaderOpenRequest) => void;
};

export function Archiver({ onOpenFile }: Props = {}) {
  const [root, setRoot] = useState<TreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [vaultWritable, setVaultWritable] = useState(false);
  // Transient banner used for "this file type isn't supported by the Reader"
  // and similar in-context messages. Auto-clears after a few seconds.
  const [notice, setNotice] = useState<string | null>(null);
  // Most-recently-connected vault paths (newest first, max 3). Persisted.
  const [history, setHistory] = useState<string[]>(() => readHistory());

  const pushHistory = useCallback((path: string) => {
    setHistory((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, VAULT_HISTORY_MAX);
      writeHistory(next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((path: string) => {
    setHistory((prev) => {
      const next = prev.filter((p) => p !== path);
      writeHistory(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Connect (or re-connect) to a folder. Returns true on success so callers
  // can decide whether to persist the path / clear a stale saved path.
  const connectToPath = useCallback(async (selected: string): Promise<boolean> => {
    setError(null);
    setSelectedPath(null);
    setConnecting(true);

    let canWriteVault = true;
    try {
      await ensureVault(selected);
    } catch (e) {
      // Still try to read the folder even if we can't write the vault file.
      canWriteVault = false;
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not initialize vault file (${msg}). Showing read-only view.`);
    }
    setVaultWritable(canWriteVault);

    const name = selected.split("/").filter(Boolean).pop() ?? selected;
    const initial: TreeNode = {
      ...makeNode(name, selected, "directory"),
      expanded: true,
      loading: true,
    };
    setRoot(initial);

    try {
      const children = await loadChildren(selected);
      setRoot((prev) =>
        prev && prev.path === selected ? { ...initial, children, loading: false } : prev,
      );
      setConnecting(false);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not read folder: ${msg}`);
      setRoot((prev) =>
        prev && prev.path === selected ? { ...initial, children: [], loading: false } : prev,
      );
      setConnecting(false);
      return false;
    }
  }, []);

  const handleConnect = useCallback(async () => {
    setError(null);
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== "string") return;
      const ok = await connectToPath(selected);
      if (ok) {
        try {
          localStorage.setItem(VAULT_PREF_KEY, selected);
        } catch {
          /* localStorage write failures are non-fatal */
        }
        pushHistory(selected);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [connectToPath, pushHistory]);

  // Connect from a clicked history entry. If the saved path no longer reads,
  // drop it from history so a stale entry doesn't linger.
  const handleConnectFromHistory = useCallback(async (path: string) => {
    const ok = await connectToPath(path);
    if (ok) {
      try {
        localStorage.setItem(VAULT_PREF_KEY, path);
      } catch {
        /* ignore */
      }
      pushHistory(path);
    } else {
      removeHistory(path);
    }
  }, [connectToPath, pushHistory, removeHistory]);

  const handleDisconnect = () => {
    setRoot(null);
    setSelectedPath(null);
    setVaultWritable(false);
    setError(null);
    try {
      localStorage.removeItem(VAULT_PREF_KEY);
    } catch {
      /* ignore */
    }
  };

  // Auto-load the last connected vault on first mount, so the user's location
  // is "memorized" across app restarts. If the saved path no longer reads,
  // we clear it so we don't keep failing on every launch.
  useEffect(() => {
    const saved = (() => {
      try {
        return localStorage.getItem(VAULT_PREF_KEY);
      } catch {
        return null;
      }
    })();
    if (!saved) return;
    (async () => {
      const ok = await connectToPath(saved);
      if (ok) {
        pushHistory(saved);
      } else {
        try {
          localStorage.removeItem(VAULT_PREF_KEY);
        } catch {
          /* ignore */
        }
        removeHistory(saved);
      }
    })();
  }, [connectToPath, pushHistory, removeHistory]);

  const handleToggleDir = useCallback(async (node: TreeNode) => {
    if (node.type !== "directory") return;

    // Already expanded → collapse.
    if (node.expanded) {
      setRoot((prev) =>
        prev ? updateNode(prev, node.path, (n) => ({ ...n, expanded: false })) : prev,
      );
      return;
    }

    // Children already loaded → just expand.
    if (node.children) {
      setRoot((prev) =>
        prev ? updateNode(prev, node.path, (n) => ({ ...n, expanded: true })) : prev,
      );
      return;
    }

    // Load children, then expand.
    setRoot((prev) =>
      prev ? updateNode(prev, node.path, (n) => ({ ...n, loading: true })) : prev,
    );
    try {
      const children = await loadChildren(node.path);
      setRoot((prev) =>
        prev
          ? updateNode(prev, node.path, (n) => ({
              ...n,
              children,
              loading: false,
              expanded: true,
            }))
          : prev,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not read ${node.path}: ${msg}`);
      setRoot((prev) =>
        prev
          ? updateNode(prev, node.path, (n) => ({
              ...n,
              children: [],
              loading: false,
              expanded: true,
            }))
          : prev,
      );
    }
  }, []);

  const handleFileClick = (node: TreeNode) => {
    setSelectedPath(node.path);
    const cls = classifyPath(node.path);
    if (!cls) {
      const ext = node.name.split(".").pop() ?? "";
      setNotice(`Cannot open in Reader: .${ext} is not a supported format.`);
      return;
    }
    setNotice(null);
    if (!root) return;
    onOpenFile?.({
      path: node.path,
      source: "vault",
      vaultRoot: root.path,
      vaultWritable,
    });
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const isDir = node.type === "directory";
    const ext = node.name.includes(".")
      ? node.name.split(".").pop()!.toLowerCase()
      : "";
    const isEbook = !isDir && EBOOK_EXTS.has(ext);
    const isSelected = selectedPath === node.path;

    return (
      <div key={node.path} className="font-mono">
        <div
          className={`flex items-center gap-2 py-1 pr-3 cursor-pointer transition-colors select-none ${
            isSelected
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
          } ${node.loading ? "opacity-60" : ""}`}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          onClick={() => (isDir ? handleToggleDir(node) : handleFileClick(node))}
        >
          {/* Caret column */}
          <span className="shrink-0 inline-flex w-4 justify-center">
            {isDir ? (
              node.expanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : null}
          </span>

          {/* Type icon */}
          {isDir ? (
            node.expanded ? (
              <FolderOpen size={16} className="shrink-0" />
            ) : (
              <Folder size={16} className="shrink-0" />
            )
          ) : (
            <FileText size={16} className={`shrink-0 ${isEbook ? "" : "opacity-50"}`} />
          )}

          {/* Name */}
          <span
            className={
              isDir
                ? "font-bold uppercase tracking-wider text-xs truncate"
                : `text-sm truncate ${isEbook ? "" : "opacity-70"}`
            }
          >
            {node.name}
          </span>

          {/* Extension chip for ebook-shaped files */}
          {isEbook && (
            <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-widest opacity-60 shrink-0">
              .{ext}
            </span>
          )}
        </div>

        {/* Children */}
        {isDir && node.expanded && node.children && (
          <>
            {node.children.length === 0 ? (
              <div
                className="font-mono text-xs italic opacity-40 py-1"
                style={{ paddingLeft: `${(depth + 1) * 1.25 + 0.5 + 1.5}rem` }}
              >
                — empty —
              </div>
            ) : (
              node.children.map((c) => renderNode(c, depth + 1))
            )}
          </>
        )}
      </div>
    );
  };

  const relativeSelected =
    selectedPath && root ? selectedPath.replace(root.path, "") || "/" : null;

  // Recent vaults list (newest first, max 3, excluding the one currently open).
  const renderHistory = () => {
    const items = history.filter((p) => p !== root?.path);
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-1">
        <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60 flex items-center gap-1 mb-1">
          <Clock size={11} /> Recent
        </div>
        {items.map((path) => {
          const name = path.split("/").filter(Boolean).pop() ?? path;
          return (
            <div
              key={path}
              className="border border-black dark:border-white flex items-stretch group"
              title={path}
            >
              <button
                onClick={() => handleConnectFromHistory(path)}
                disabled={connecting}
                className="flex-1 min-w-0 text-left px-2 py-1.5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-50"
              >
                <div className="font-mono text-xs truncate">{name}</div>
                <div className="font-mono text-[0.55rem] opacity-60 truncate group-hover:opacity-100">
                  {path}
                </div>
              </button>
              <button
                onClick={() => removeHistory(path)}
                className="px-2 border-l border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                aria-label={`Forget ${name}`}
                title="Forget this vault"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grow flex h-full overflow-hidden bg-white dark:bg-black text-black dark:text-white">
      {/* Left sidebar */}
      <div className="w-1/3 border-r border-black dark:border-white flex flex-col">
        <div className="p-4 bg-black text-white dark:bg-white dark:text-black font-mono uppercase text-sm tracking-widest flex items-center gap-2 shrink-0">
          <HardDrive size={16} /> Volume Manager
        </div>
        <div className="p-8 flex flex-col gap-6 overflow-y-auto">
          <p className="font-serif text-sm leading-relaxed">
            Link a local folder as a Triptych vault. A hidden{" "}
            <span className="font-mono">.triptych/</span> directory will be created inside to
            store bookmarks, extracts, and per-vault preferences. Your files are never copied
            or uploaded.
          </p>

          {!root ? (
            <>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full border-2 border-black dark:border-white py-3 font-mono uppercase tracking-widest text-sm font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
              >
                <Folder size={18} /> {connecting ? "Connecting…" : "Connect Local Folder"}
              </button>
              {renderHistory()}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="border border-black dark:border-white p-3 break-all">
                <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60 mb-1">
                  Connected vault
                </div>
                <div className="font-mono text-xs leading-relaxed">{root.path}</div>
              </div>
              <button
                onClick={handleConnect}
                className="w-full border border-black dark:border-white py-2 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
              >
                Switch Folder…
              </button>
              <button
                onClick={handleDisconnect}
                className="w-full border border-black dark:border-white py-2 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center justify-center gap-2"
              >
                <X size={12} /> Disconnect
              </button>
              {renderHistory()}
            </div>
          )}

          {error && (
            <div className="p-4 border border-black dark:border-white font-mono text-xs whitespace-pre-wrap">
              <span className="font-bold block mb-1">Notice</span>
              {error}
            </div>
          )}

          {notice && (
            <div className="p-4 border border-black dark:border-white bg-black text-white dark:bg-white dark:text-black font-mono text-xs whitespace-pre-wrap">
              <span className="font-bold block mb-1">⚠ Cannot Open</span>
              {notice}
            </div>
          )}
        </div>
      </div>

      {/* Right pane */}
      <div className="w-2/3 flex flex-col bg-white dark:bg-black">
        <div className="p-4 border-b border-black dark:border-white font-mono text-xs tracking-widest flex justify-between items-center shrink-0 gap-4">
          <span className="truncate">PATH: {root?.path ?? "—"}</span>
          {relativeSelected && (
            <span className="truncate text-black/60 dark:text-white/60 max-w-md text-right">
              SELECTED: {relativeSelected}
            </span>
          )}
        </div>

        <div className="p-6 overflow-y-auto grow bg-white dark:bg-black">
          {root ? (
            <div className="border border-black dark:border-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] min-h-full">
              {renderNode(root)}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <Folder size={64} className="mb-6 opacity-30" />
              <p className="font-mono text-sm text-black/60 dark:text-white/60 max-w-sm leading-relaxed">
                No vault connected.
                <br />
                Click <span className="font-bold">Connect Local Folder</span> on the left to
                pick a directory from your filesystem.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
