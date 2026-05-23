import { useCallback, useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import mammoth from "mammoth";
import { EpubReader } from "./readers/EpubReader";
import { PdfReader } from "./readers/PdfReader";
import { TextReader } from "./readers/TextReader";
import { HtmlReader } from "./readers/HtmlReader";
import { classifyPath, SUPPORTED_EXTS, type Classification } from "./readers/formats";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  type ReaderTheme,
  type SplitMode,
} from "./readers/ReaderShell";
import { useReadingTimer } from "./readers/useReadingTimer";

const SPLIT_PREF_KEY = "triptych.reader.split";
const FONT_PREF_KEY = "triptych.reader.fontScale";
const THEME_PREF_KEY = "triptych.reader.theme";

function loadSplit(): SplitMode {
  if (typeof localStorage === "undefined") return 1;
  return localStorage.getItem(SPLIT_PREF_KEY) === "2" ? 2 : 1;
}
function loadFontScale(): number {
  if (typeof localStorage === "undefined") return 1;
  const raw = parseFloat(localStorage.getItem(FONT_PREF_KEY) ?? "1");
  if (!Number.isFinite(raw)) return 1;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, raw));
}
function loadTheme(): ReaderTheme {
  if (typeof localStorage === "undefined") return "light";
  return localStorage.getItem(THEME_PREF_KEY) === "dark" ? "dark" : "light";
}

type LoadedFile =
  | { kind: "epub"; buffer: ArrayBuffer; name: string }
  | { kind: "pdf"; buffer: ArrayBuffer; name: string }
  | {
      kind: "text";
      buffer: ArrayBuffer;
      name: string;
      format: Extract<Classification, { kind: "text" }>["format"];
    }
  | { kind: "html"; html: string; name: string; label: string };

async function readBuffer(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

type Props = {
  pendingPath?: string | null;
  onPendingConsumed?: () => void;
};

export function ReadingTable({ pendingPath, onPendingConsumed }: Props) {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading…");
  const [error, setError] = useState<string | null>(null);
  const [split, setSplit] = useState<SplitMode>(loadSplit);
  const [fontScale, setFontScale] = useState<number>(loadFontScale);
  const [theme, setTheme] = useState<ReaderTheme>(loadTheme);

  // Timer lives at the table level so split/unsplit doesn't reset it.
  // Resets only when the open file changes.
  const readingSeconds = useReadingTimer(file?.name ?? null);

  const toggleSplit = useCallback(() => {
    setSplit((s) => {
      const next: SplitMode = s === 1 ? 2 : 1;
      try {
        localStorage.setItem(SPLIT_PREF_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const persistFont = (v: number) => {
    try {
      localStorage.setItem(FONT_PREF_KEY, v.toFixed(2));
    } catch {
      /* ignore */
    }
  };
  const incFont = useCallback(() => {
    setFontScale((v) => {
      const next = Math.min(FONT_SCALE_MAX, +(v + FONT_SCALE_STEP).toFixed(2));
      persistFont(next);
      return next;
    });
  }, []);
  const decFont = useCallback(() => {
    setFontScale((v) => {
      const next = Math.max(FONT_SCALE_MIN, +(v - FONT_SCALE_STEP).toFixed(2));
      persistFont(next);
      return next;
    });
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next: ReaderTheme = t === "light" ? "dark" : "light";
      try {
        localStorage.setItem(THEME_PREF_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const loadFromPath = useCallback(async (path: string) => {
    setError(null);
    const klass = classifyPath(path);
    if (!klass) {
      const ext = path.split(".").pop() ?? "";
      setError(`Unsupported format: .${ext}`);
      setFile(null);
      return;
    }
    const name = path.split("/").pop() ?? path;
    setLoadingMessage("Loading…");
    setLoading(true);
    try {
      if (klass.kind === "docx") {
        setLoadingMessage("Parsing .docx…");
        const buffer = await readBuffer(path);
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        setFile({ kind: "html", html: result.value, name, label: "Word (.docx)" });
      } else if (klass.kind === "doc") {
        setLoadingMessage("Converting .doc via textutil…");
        const html = await invoke<string>("convert_doc", { path });
        setFile({ kind: "html", html, name, label: "Word (.doc)" });
      } else if (klass.kind === "text") {
        const buffer = await readBuffer(path);
        setFile({ kind: "text", buffer, name, format: klass.format });
      } else {
        const buffer = await readBuffer(path);
        setFile({ kind: klass.kind, buffer, name });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const openBook = useCallback(async () => {
    setError(null);
    try {
      const path = await open({
        filters: [{ name: "Documents", extensions: [...SUPPORTED_EXTS] }],
      });
      if (!path || typeof path !== "string") return;
      await loadFromPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loadFromPath]);

  useEffect(() => {
    if (!pendingPath) return;
    let cancelled = false;
    (async () => {
      await loadFromPath(pendingPath);
      if (!cancelled) onPendingConsumed?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingPath, loadFromPath, onPendingConsumed]);

  if (!file) {
    return (
      <div className="grow flex items-center justify-center bg-white dark:bg-black text-black dark:text-white">
        <div className="text-center max-w-md px-8">
          <div className="font-serif text-4xl mb-3">Reading Table</div>
          <p className="font-mono text-sm text-black/60 dark:text-white/60 mb-8 tracking-wide">
            Open a document to begin.
            <br />
            <span className="text-[0.7rem] opacity-70 tracking-widest uppercase">
              .epub · .pdf · .docx · .doc · .md · .txt · .json · .yaml
            </span>
          </p>
          <button
            onClick={openBook}
            disabled={loading}
            className="border-2 border-black dark:border-white px-6 py-3 font-mono uppercase tracking-widest text-sm font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all flex items-center gap-2 mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
          >
            <BookOpen size={18} /> {loading ? loadingMessage : "Open Document"}
          </button>
          {error && (
            <div className="mt-8 p-4 border border-black dark:border-white font-mono text-xs text-left whitespace-pre-wrap">
              <span className="font-bold block mb-1">Error</span>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  const sharedShell = {
    onChange: openBook,
    split,
    onSplitToggle: toggleSplit,
    fontScale,
    onFontInc: incFont,
    onFontDec: decFont,
    theme,
    onThemeToggle: toggleTheme,
    readingSeconds,
  };

  const renderReader = (paneKey: string) => {
    if (file.kind === "epub") {
      return (
        <EpubReader
          key={paneKey}
          buffer={file.buffer}
          fileName={file.name}
          {...sharedShell}
        />
      );
    }
    if (file.kind === "pdf") {
      return (
        <PdfReader
          key={paneKey}
          buffer={file.buffer}
          fileName={file.name}
          {...sharedShell}
        />
      );
    }
    if (file.kind === "html") {
      return (
        <HtmlReader
          key={paneKey}
          html={file.html}
          fileName={file.name}
          formatLabel={file.label}
          {...sharedShell}
        />
      );
    }
    return (
      <TextReader
        key={paneKey}
        buffer={file.buffer}
        fileName={file.name}
        format={file.format}
        {...sharedShell}
      />
    );
  };

  const dividerClass = theme === "dark" ? "border-white" : "border-black";
  if (split === 2) {
    return (
      <div className="grow flex min-h-0">
        <div className={`flex-1 min-w-0 flex flex-col border-r ${dividerClass}`}>
          {renderReader("pane-a")}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">{renderReader("pane-b")}</div>
      </div>
    );
  }
  return renderReader("pane-single");
}
