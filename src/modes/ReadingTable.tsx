import { useCallback, useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, writeTextFile } from "@tauri-apps/plugin-fs";
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
import type { ReaderOpenRequest, ReaderAccess } from "./readers/readerTypes";
import {
  useReaderAnnotations,
  type ReaderAnnotation,
  type ReaderAnnotationKind,
  type ReaderAnnotationLocator,
  type ReaderDocumentAnnotationMeta,
} from "../state/ReaderAnnotationsContext";

const SPLIT_PREF_KEY = "triptych.reader.split";
const FONT_PREF_KEY = "triptych.reader.fontScale";
const THEME_PREF_KEY = "triptych.reader.theme";

type MarkdownViewMode = "read" | "write";
type MarkdownSaveStatus = "saved" | "unsaved" | "saving" | "failed";

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
  | ({ kind: "epub"; buffer: ArrayBuffer; name: string } & ReaderAccess)
  | ({ kind: "pdf"; buffer: ArrayBuffer; name: string } & ReaderAccess)
  | {
      kind: "text";
      buffer: ArrayBuffer;
      name: string;
      format: Extract<Classification, { kind: "text" }>["format"];
    } & ReaderAccess
  | ({ kind: "html"; html: string; name: string; label: string } & ReaderAccess);

async function readBuffer(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function decodeUtf8(buffer: ArrayBuffer) {
  return new TextDecoder("utf-8", { fatal: false })
    .decode(buffer)
    .replace(/^﻿/, "");
}

type Props = {
  pendingOpenRequest?: ReaderOpenRequest | null;
  onPendingConsumed?: () => void;
};

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Bytes(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return toHex(digest);
}

async function sha256Text(value: string) {
  const bytes = new TextEncoder().encode(value);
  return sha256Bytes(bytes.buffer as ArrayBuffer);
}

function relativeToVault(path: string, vaultRoot?: string) {
  if (!vaultRoot) return path.split("/").pop() ?? path;
  if (path === vaultRoot) return "/";
  const prefix = vaultRoot.endsWith("/") ? vaultRoot : `${vaultRoot}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path.split("/").pop() ?? path;
}

async function buildAccess(request: ReaderOpenRequest, buffer: ArrayBuffer): Promise<ReaderAccess> {
  const contentHash = await sha256Bytes(buffer);
  const relativePath = request.source === "vault"
    ? relativeToVault(request.path, request.vaultRoot)
    : request.path.split("/").pop() ?? request.path;
  const documentKey = request.source === "vault"
    ? await sha256Text(`${relativePath}\n${contentHash}`)
    : `direct:${contentHash}`;
  const canWriteVault = request.source === "vault" && request.vaultWritable;
  const status = request.source === "direct"
    ? "Read-only · opened directly"
    : canWriteVault
      ? "Vault editing enabled"
      : "Read-only · vault metadata unavailable";
  return {
    path: request.path,
    source: request.source,
    canWriteVault,
    status,
    vaultRoot: request.source === "vault" ? request.vaultRoot : undefined,
    relativePath,
    documentKey,
  };
}

function annotationMeta(file: LoadedFile): ReaderDocumentAnnotationMeta {
  const format = file.kind === "text" ? file.format : file.kind;
  return {
    documentKey: file.documentKey,
    relativePath: file.relativePath,
    fileName: file.name,
    format,
  };
}

export function ReadingTable({ pendingOpenRequest, onPendingConsumed }: Props) {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading…");
  const [error, setError] = useState<string | null>(null);
  const [split, setSplit] = useState<SplitMode>(loadSplit);
  const [fontScale, setFontScale] = useState<number>(loadFontScale);
  const [theme, setTheme] = useState<ReaderTheme>(loadTheme);
  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>([]);
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [markdownOriginal, setMarkdownOriginal] = useState("");
  const [markdownMode, setMarkdownMode] = useState<MarkdownViewMode>("write");
  const [markdownSaveStatus, setMarkdownSaveStatus] = useState<MarkdownSaveStatus>("saved");
  const annotationStore = useReaderAnnotations();

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

  const loadFromRequest = useCallback(async (request: ReaderOpenRequest) => {
    const { path } = request;
    setError(null);
    setAnnotations([]);
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
        const access = await buildAccess(request, buffer);
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        setFile({ kind: "html", html: result.value, name, label: "Word (.docx)", ...access });
      } else if (klass.kind === "doc") {
        setLoadingMessage("Converting .doc via textutil…");
        const html = await invoke<string>("convert_doc", { path });
        const access = await buildAccess(request, new TextEncoder().encode(html).buffer as ArrayBuffer);
        setFile({ kind: "html", html, name, label: "Word (.doc)", ...access });
      } else if (klass.kind === "text") {
        const buffer = await readBuffer(path);
        const access = await buildAccess(request, buffer);
        setFile({ kind: "text", buffer, name, format: klass.format, ...access });
      } else {
        const buffer = await readBuffer(path);
        const access = await buildAccess(request, buffer);
        setFile({ kind: klass.kind, buffer, name, ...access });
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
      await loadFromRequest({ path, source: "direct" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loadFromRequest]);

  useEffect(() => {
    if (!pendingOpenRequest) return;
    let cancelled = false;
    (async () => {
      await loadFromRequest(pendingOpenRequest);
      if (!cancelled) onPendingConsumed?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingOpenRequest, loadFromRequest, onPendingConsumed]);

  useEffect(() => {
    if (!file || !file.canWriteVault || !file.vaultRoot || (file.kind !== "epub" && file.kind !== "pdf")) {
      setAnnotations([]);
      return;
    }
    let cancelled = false;
    const meta = annotationMeta(file);
    void annotationStore.loadDocument(file.vaultRoot, meta).then((items) => {
      if (!cancelled) setAnnotations(items);
    });
    return () => {
      cancelled = true;
    };
  }, [annotationStore, file]);

  useEffect(() => {
    if (file?.kind === "text" && file.format === "md") {
      const next = decodeUtf8(file.buffer);
      setMarkdownDraft(next);
      setMarkdownOriginal(next);
      setMarkdownSaveStatus("saved");
      setMarkdownMode(file.canWriteVault ? "write" : "read");
      return;
    }
    setMarkdownDraft("");
    setMarkdownOriginal("");
    setMarkdownSaveStatus("saved");
    setMarkdownMode("write");
  }, [file]);

  useEffect(() => {
    if (!file || file.kind !== "text" || file.format !== "md" || !file.canWriteVault) return;
    if (markdownDraft === markdownOriginal) {
      setMarkdownSaveStatus("saved");
      return;
    }
    setMarkdownSaveStatus("unsaved");
    const timer = window.setTimeout(() => {
      setMarkdownSaveStatus("saving");
      void writeTextFile(file.path, markdownDraft)
        .then(() => {
          setMarkdownOriginal(markdownDraft);
          setMarkdownSaveStatus("saved");
        })
        .catch((e) => {
          setMarkdownSaveStatus("failed");
          setError(e instanceof Error ? e.message : String(e));
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [file, markdownDraft, markdownOriginal]);

  const addAnnotation = useCallback(
    async (
      kind: ReaderAnnotationKind,
      locator: ReaderAnnotationLocator,
      quote?: string,
    ) => {
      if (!file || !file.canWriteVault || !file.vaultRoot) return null;
      const next = await annotationStore.addAnnotation(file.vaultRoot, annotationMeta(file), {
        kind,
        locator,
        quote,
      });
      if (next) setAnnotations((prev) => [...prev, next]);
      return next;
    },
    [annotationStore, file],
  );

  const removeAnnotation = useCallback(
    async (annotationId: string) => {
      if (!file || !file.canWriteVault || !file.vaultRoot) return;
      await annotationStore.removeAnnotation(file.vaultRoot, annotationMeta(file), annotationId);
      setAnnotations((prev) => prev.filter((annotation) => annotation.id !== annotationId));
    },
    [annotationStore, file],
  );

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
          readerStatus={file.status}
          annotationsEnabled={file.canWriteVault}
          annotations={annotations}
          onAddAnnotation={addAnnotation}
          onRemoveAnnotation={removeAnnotation}
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
          readerStatus={file.status}
          annotationsEnabled={file.canWriteVault}
          annotations={annotations}
          onAddAnnotation={addAnnotation}
          onRemoveAnnotation={removeAnnotation}
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
          readerStatus={file.status}
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
        readerStatus={file.status}
        canEditMarkdown={file.format === "md" && file.canWriteVault}
        markdownDraft={file.format === "md" ? markdownDraft : undefined}
        onMarkdownDraftChange={file.format === "md" ? setMarkdownDraft : undefined}
        markdownMode={file.format === "md" ? markdownMode : undefined}
        onMarkdownModeChange={file.format === "md" ? setMarkdownMode : undefined}
        markdownSaveStatus={file.format === "md" ? markdownSaveStatus : undefined}
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
