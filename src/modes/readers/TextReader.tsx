import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Highlighter, ListChecks, MessageSquareOff, Strikethrough, Underline } from "lucide-react";
import { visit, SKIP } from "unist-util-visit";
import type { Root, Text } from "mdast";
import "katex/dist/katex.min.css";
import { ReaderShell, type ReaderTheme, type SplitMode } from "./ReaderShell";
import { MarkdownLiveEditor, type MarkdownLiveEditorHandle } from "./MarkdownLiveEditor";
import type { TextFormat } from "./formats";

// Tiny remark plugin: convert `==text==` runs in plain text nodes into a
// custom MDAST node that remark-rehype renders as a real <mark> element
// (via `data.hName`). No raw-HTML pass-through needed.
function remarkHighlight() {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || typeof index !== "number") return;
      const value = node.value;
      if (!value.includes("==")) return;
      const regex = /==([^=\n]+?)==/g;
      const parts: Array<Text | { type: "highlight"; data: { hName: string }; children: Text[] }> = [];
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(value))) {
        if (m.index > last) parts.push({ type: "text", value: value.slice(last, m.index) });
        parts.push({
          type: "highlight",
          data: { hName: "mark" },
          children: [{ type: "text", value: m[1] }],
        });
        last = regex.lastIndex;
      }
      if (parts.length === 0) return;
      if (last < value.length) parts.push({ type: "text", value: value.slice(last) });
      // Splice the new nodes in and skip past them so we don't re-process.
      parent.children.splice(index, 1, ...(parts as never[]));
      return [SKIP, index + parts.length];
    });
  };
}

function remarkUnderline() {
  return (tree: Root) => {
    const walk = (node: { children?: unknown[] }) => {
      if (!Array.isArray(node.children)) return;
      const children = node.children as Array<{ type: string; value?: string; children?: unknown[] }>;
      const next: typeof children = [];
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        if (child.type !== "html" || child.value?.toLowerCase() !== "<u>") {
          next.push(child);
          continue;
        }

        const underlined: typeof children = [];
        let closeIndex = -1;
        for (let j = i + 1; j < children.length; j += 1) {
          const candidate = children[j];
          if (candidate.type === "html" && candidate.value?.toLowerCase() === "</u>") {
            closeIndex = j;
            break;
          }
          underlined.push(candidate);
        }

        if (closeIndex < 0 || underlined.length === 0) {
          next.push(child);
          continue;
        }

        next.push({
          type: "underline",
          data: { hName: "u" },
          children: underlined,
        } as never);
        i = closeIndex;
      }
      node.children = next;
      next.forEach((child) => walk(child as { children?: unknown[] }));
    };
    walk(tree as { children?: unknown[] });
  };
}

function remarkObsidianCommentLines() {
  return (tree: Root) => {
    visit(tree, "paragraph", (node, index, parent) => {
      if (!parent || typeof index !== "number") return;
      const children = "children" in node ? node.children : [];
      if (
        children.length !== 1 ||
        children[0].type !== "text"
      ) {
        return;
      }
      const body = markdownCommentBody(children[0].value);
      if (body === null) return;
      parent.children.splice(index, 1, {
        type: "obsidianCommentLine",
        data: {
          hName: "div",
          hProperties: { className: "markdown-comment-line" },
        },
        children: [{ type: "text", value: body || " " }],
      } as never);
      return [SKIP, index + 1];
    });
  };
}

function normalizeMarkdownCodeDelimiters(source: string) {
  type Fence =
    | { kind: "standard"; marker: "`" | "~"; length: number }
    | { kind: "quote" };

  let fence: Fence | null = null;
  const normalizeInlineCode = (line: string) =>
    line.replace(/(['‘’｀]{2})([^\n]*?\S[^\n]*?)(['‘’｀]{2})/g, (match, _open, body: string) => {
      const tickRuns = body.match(/`+/g) ?? [];
      if (tickRuns.some((run) => run.length > 1)) {
        return match;
      }
      return body.includes("`") ? `\`\` ${body} \`\`` : `\`${body}\``;
    });

  const lines = source.split(/\r?\n/);
  const normalizedLines = lines.map((line) => {
    if (fence?.kind === "standard") {
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (closing?.[1]?.startsWith(fence.marker) && closing[1].length >= fence.length) {
        fence = null;
      }
      return line;
    }

    if (fence?.kind === "quote") {
      if (/^ {0,3}['‘’｀]{3,}\s*$/.test(line)) {
        fence = null;
        return "```";
      }
      return line;
    }

    const standardFence = line.match(/^( {0,3})(`{3,}|~{3,})([^\n]*)$/);
    if (standardFence) {
      fence = {
        kind: "standard",
        marker: standardFence[2][0] as "`" | "~",
        length: standardFence[2].length,
      };
      return line;
    }

    const quoteFence = line.match(/^( {0,3})(['‘’｀]{3,})([^\n]*)$/);
    if (quoteFence) {
      fence = { kind: "quote" };
      return `${quoteFence[1]}\`\`\`${quoteFence[3]}`;
    }

    return normalizeInlineCode(line);
  });

  return normalizedLines.join("\n");
}

export type { TextFormat };

type Props = {
  buffer: ArrayBuffer;
  fileName: string;
  format: TextFormat;
  onChange: () => void;
  split: SplitMode;
  onSplitToggle: () => void;
  fontScale: number;
  onFontInc: () => void;
  onFontDec: () => void;
  theme: ReaderTheme;
  onThemeToggle: () => void;
  readingSeconds: number;
  readerStatus?: string;
  canEditMarkdown?: boolean;
  markdownDraft?: string;
  onMarkdownDraftChange?: (next: string) => void;
  markdownMode?: "read" | "write";
  onMarkdownModeChange?: (mode: "read" | "write") => void;
  markdownSaveStatus?: "saved" | "unsaved" | "saving" | "failed";
};

const FORMAT_LABEL: Record<TextFormat, string> = {
  md: "Markdown",
  txt: "Plain Text",
  json: "JSON",
  yaml: "YAML",
};

function markdownCommentBody(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("%%") || !trimmed.endsWith("%%") || trimmed.length < 4) return null;
  return trimmed.slice(2, -2).trim();
}

export function TextReader({
  buffer,
  fileName,
  format,
  onChange,
  split,
  onSplitToggle,
  fontScale,
  onFontInc,
  onFontDec,
  theme,
  onThemeToggle,
  readingSeconds,
  readerStatus,
  canEditMarkdown = false,
  markdownDraft,
  onMarkdownDraftChange,
  markdownMode = "read",
  onMarkdownModeChange,
  markdownSaveStatus = "saved",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MarkdownLiveEditorHandle>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const text = useMemo(() => {
    try {
      return new TextDecoder("utf-8", { fatal: false })
        .decode(buffer)
        .replace(/^﻿/, "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return "";
    }
  }, [buffer]);

  const formattedText = useMemo(() => {
    if (format !== "json") return text;
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }, [text, format]);

  const isWritableMarkdown = format === "md" && canEditMarkdown && markdownDraft !== undefined && onMarkdownDraftChange;
  const isWriteMode = isWritableMarkdown && markdownMode === "write";
  const draft = isWritableMarkdown ? markdownDraft : text;
  const setDraft = onMarkdownDraftChange ?? (() => undefined);
  const markdownSource = format === "md" ? draft : text;

  const markdownText = useMemo(
    () => (format === "md" ? normalizeMarkdownCodeDelimiters(markdownSource) : markdownSource),
    [markdownSource, format],
  );
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? el.scrollTop / max : 0);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [formattedText, text, markdownText, isWriteMode, draft]);

  const pageBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.9 * dir, behavior: "smooth" });
  };

  const themeClass = theme === "dark" ? "reader-dark" : "";
  const markdownColumnClass = split === 1 ? "md-reader-column" : "md-reader-column-split";

  const markdownToolbar = isWritableMarkdown ? (
    <div className="flex items-center gap-2">
      <div className="flex items-center border border-black dark:border-white font-mono uppercase tracking-widest text-[9px]">
        <button
          type="button"
          onClick={() => onMarkdownModeChange?.("read")}
          className={[
            "px-2 py-1",
            markdownMode === "read" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black",
          ].join(" ")}
        >
          Read
        </button>
        <button
          type="button"
          onClick={() => onMarkdownModeChange?.("write")}
          className={[
            "px-2 py-1 border-l border-black dark:border-white",
            markdownMode === "write" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black",
          ].join(" ")}
        >
          Write
        </button>
      </div>
      {isWriteMode && (
        <div className="flex items-center gap-1 border border-black dark:border-white px-1 py-0.5">
          <button
            type="button"
            onClick={() => editorRef.current?.wrapSelection("==", "==", "highlight")}
            className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            title="Highlight selection"
            aria-label="Highlight selection"
          >
            <Highlighter size={13} />
          </button>
          <button
            type="button"
            onClick={() => editorRef.current?.wrapSelection("<u>", "</u>", "underline")}
            className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            title="Underline selection"
            aria-label="Underline selection"
          >
            <Underline size={13} />
          </button>
          <button
            type="button"
            onClick={() => editorRef.current?.wrapSelection("~~", "~~", "strikethrough")}
            className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            title="Strikethrough selection"
            aria-label="Strikethrough selection"
          >
            <Strikethrough size={13} />
          </button>
          <button
            type="button"
            onClick={() => editorRef.current?.insertTask()}
            className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            title="Insert checkbox task"
            aria-label="Insert checkbox task"
          >
            <ListChecks size={13} />
          </button>
          <button
            type="button"
            onClick={() => editorRef.current?.toggleComment()}
            className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            title="Toggle Obsidian comment line (⌘/)"
            aria-label="Toggle Obsidian comment line"
          >
            <MessageSquareOff size={13} />
          </button>
        </div>
      )}
      <span className="border border-black dark:border-white px-2 py-1 font-mono uppercase tracking-widest text-[9px] opacity-65">
        {markdownSaveStatus === "saving"
          ? "Saving..."
          : markdownSaveStatus === "failed"
            ? "Save failed"
            : markdownSaveStatus === "unsaved"
              ? "Unsaved"
              : "Saved"}
      </span>
    </div>
  ) : null;

  return (
    <ReaderShell
      title={fileName}
      location={FORMAT_LABEL[format]}
      progress={progress}
      onPrev={() => pageBy(-1)}
      onNext={() => pageBy(1)}
      onChange={onChange}
      split={split}
      onSplitToggle={onSplitToggle}
      fontScale={fontScale}
      onFontInc={onFontInc}
      onFontDec={onFontDec}
      theme={theme}
      onThemeToggle={onThemeToggle}
      readingSeconds={readingSeconds}
      status={readerStatus}
      toolbarExtra={markdownToolbar}
    >
      <div
        ref={scrollRef}
        className={`absolute inset-0 px-8 py-8 overflow-y-auto ${themeClass}`}
        style={{ fontSize: `${fontScale}rem` }}
      >
        {error ? (
          <div className="max-w-md mx-auto p-4 border font-mono text-xs">
            <span className="font-bold block mb-1">Error</span>
            {error}
          </div>
        ) : isWriteMode ? (
          <div className={`md-body md-body-wide mx-auto ${markdownColumnClass}`}>
            <MarkdownLiveEditor ref={editorRef} value={draft} onChange={setDraft} />
          </div>
        ) : format === "md" ? (
          <div className={`md-body md-body-wide mx-auto ${markdownColumnClass}`}>
            {readerStatus?.startsWith("Read-only") && (
              <div className="mb-4 border border-black dark:border-white px-4 py-3 font-mono uppercase tracking-widest text-[10px]">
                {readerStatus} · open from Archiver to edit
              </div>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkHighlight, remarkUnderline, remarkObsidianCommentLines]}
              rehypePlugins={[rehypeKatex]}
            >
              {markdownText}
            </ReactMarkdown>
          </div>
        ) : format === "txt" ? (
          <div className="max-w-3xl mx-auto font-serif text-base leading-loose whitespace-pre-wrap">
            {text}
          </div>
        ) : (
          <pre className="max-w-3xl mx-auto font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
            {formattedText}
          </pre>
        )}
      </div>
    </ReaderShell>
  );
}
