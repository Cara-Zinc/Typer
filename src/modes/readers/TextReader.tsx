import { useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Highlighter, ListChecks, Strikethrough, Underline } from "lucide-react";
import { visit, SKIP } from "unist-util-visit";
import type { Root, Text } from "mdast";
import "katex/dist/katex.min.css";
import { ReaderShell, type ReaderTheme, type SplitMode } from "./ReaderShell";
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

const TASK_LINE_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\]\s*)/;

type MarkdownLine = {
  text: string;
  start: number;
  end: number;
};

type MarkdownBlock = {
  id: string;
  type: "blank" | "code" | "heading" | "list" | "table" | "paragraph";
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  text: string;
};

function splitMarkdownLines(source: string): MarkdownLine[] {
  if (source.length === 0) return [{ text: "", start: 0, end: 0 }];
  const rawLines = source.split("\n");
  let offset = 0;
  return rawLines.map((raw, index) => {
    const hasNewline = index < rawLines.length - 1;
    const text = hasNewline ? `${raw}\n` : raw;
    const line = { text, start: offset, end: offset + text.length };
    offset = line.end;
    return line;
  });
}

function plainLine(line: MarkdownLine) {
  return line.text.replace(/\n$/, "");
}

function isBlankLine(line: MarkdownLine) {
  return plainLine(line).trim() === "";
}

function isFenceStart(line: MarkdownLine) {
  return plainLine(line).match(/^ {0,3}(`{3,}|~{3,})/);
}

function isFenceEnd(line: MarkdownLine, marker: string) {
  return plainLine(line).match(new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`));
}

function isTableStart(lines: MarkdownLine[], index: number) {
  const current = plainLine(lines[index] ?? { text: "", start: 0, end: 0 });
  const next = plainLine(lines[index + 1] ?? { text: "", start: 0, end: 0 });
  return current.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next);
}

function startsBlock(lines: MarkdownLine[], index: number) {
  const line = lines[index];
  if (!line || isBlankLine(line)) return true;
  const text = plainLine(line);
  return Boolean(
    isFenceStart(line) ||
    isTableStart(lines, index) ||
    /^ {0,3}#{1,6}\s+/.test(text) ||
    /^(\s*)([-*+]|\d+[.)])\s+/.test(text),
  );
}

function makeBlock(source: string, lines: MarkdownLine[], startLine: number, endLine: number, type: MarkdownBlock["type"]): MarkdownBlock {
  const startOffset = lines[startLine].start;
  const endOffset = lines[endLine].end;
  return {
    id: String(startOffset),
    type,
    startLine,
    endLine,
    startOffset,
    endOffset,
    text: source.slice(startOffset, endOffset),
  };
}

function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = splitMarkdownLines(source);
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isBlankLine(lines[i])) {
      const start = i;
      while (i + 1 < lines.length && isBlankLine(lines[i + 1])) i += 1;
      blocks.push(makeBlock(source, lines, start, i, "blank"));
      i += 1;
      continue;
    }

    const fence = isFenceStart(lines[i]);
    if (fence) {
      const start = i;
      const marker = fence[1];
      i += 1;
      while (i < lines.length && !isFenceEnd(lines[i], marker)) i += 1;
      if (i < lines.length) i += 1;
      blocks.push(makeBlock(source, lines, start, Math.max(start, i - 1), "code"));
      continue;
    }

    if (isTableStart(lines, i)) {
      const start = i;
      i += 2;
      while (i < lines.length && plainLine(lines[i]).includes("|") && !isBlankLine(lines[i])) i += 1;
      blocks.push(makeBlock(source, lines, start, i - 1, "table"));
      continue;
    }

    if (/^ {0,3}#{1,6}\s+/.test(plainLine(lines[i]))) {
      blocks.push(makeBlock(source, lines, i, i, "heading"));
      i += 1;
      continue;
    }

    const listMatch = plainLine(lines[i]).match(/^(\s*)([-*+]|\d+[.)])\s+/);
    if (listMatch) {
      const start = i;
      const indent = listMatch[1].length;
      i += 1;
      while (
        i < lines.length &&
        !isBlankLine(lines[i]) &&
        !plainLine(lines[i]).match(new RegExp(`^\\s{0,${indent}}(?:[-*+]|\\d+[.)])\\s+`)) &&
        (/^\s+/.test(plainLine(lines[i])) || !startsBlock(lines, i))
      ) {
        i += 1;
      }
      blocks.push(makeBlock(source, lines, start, i - 1, "list"));
      continue;
    }

    const start = i;
    i += 1;
    while (i < lines.length && !startsBlock(lines, i)) i += 1;
    blocks.push(makeBlock(source, lines, start, i - 1, "paragraph"));
  }

  return blocks;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);

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
  const markdownBlocks = useMemo(
    () => (isWriteMode ? parseMarkdownBlocks(draft) : []),
    [draft, isWriteMode],
  );
  const markdownLines = useMemo(
    () => (isWriteMode ? splitMarkdownLines(draft) : []),
    [draft, isWriteMode],
  );
  const activeLine = activeLineIndex === null ? null : markdownLines[activeLineIndex] ?? null;

  useEffect(() => {
    if (activeLineIndex === null || activeLineIndex < markdownLines.length) return;
    setActiveLineIndex(markdownLines.length > 0 ? markdownLines.length - 1 : null);
  }, [activeLineIndex, markdownLines.length]);

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
  }, [formattedText, text, markdownText, isWriteMode, markdownBlocks.length, markdownLines.length]);

  const pageBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.9 * dir, behavior: "smooth" });
  };

  const themeClass = theme === "dark" ? "reader-dark" : "";
  const markdownColumnClass = split === 1 ? "md-reader-column" : "md-reader-column-split";

  const replaceLine = (line: MarkdownLine, nextText: string) => {
    const trailingNewline = line.text.endsWith("\n") ? "\n" : "";
    setDraft(`${draft.slice(0, line.start)}${nextText}${trailingNewline}${draft.slice(line.end)}`);
  };

  const applyMarkdownWrap = (before: string, after: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !activeLine) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineText = plainLine(activeLine);
    const selected = lineText.slice(start, end) || placeholder;
    replaceLine(activeLine, `${lineText.slice(0, start)}${before}${selected}${after}${lineText.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertTaskCheckbox = () => {
    const textarea = textareaRef.current;
    if (!textarea || !activeLine) {
      const prefix = draft.length > 0 && !draft.endsWith("\n") ? "\n" : "";
      setDraft(`${draft}${prefix}- [ ] task`);
      setActiveLineIndex(markdownLines.length);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineText = plainLine(activeLine);
    const selected = lineText.slice(start, end);

    if (selected) {
      const replacement = selected
        .split("\n")
        .map((line) => (TASK_LINE_RE.test(line) ? line : `- [ ] ${line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")}`))
        .join("\n");
      replaceLine(activeLine, `${lineText.slice(0, start)}${replacement}${lineText.slice(end)}`);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + replacement.length);
      });
      return;
    }

    const needsLineBreak = start > 0 && lineText[start - 1] !== "\n";
    const insertion = `${needsLineBreak ? "\n" : ""}- [ ] task`;
    const nextLine = `${lineText.slice(0, start)}${insertion}${lineText.slice(end)}`;
    const taskStart = start + insertion.length - "task".length;
    replaceLine(activeLine, nextLine);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(taskStart, taskStart + "task".length);
    });
  };

  const toggleTaskCheckboxAtLine = (lineIndex: number, checked: boolean) => {
    const lines = draft.split("\n");
    lines[lineIndex] = lines[lineIndex].replace(TASK_LINE_RE, `$1${checked ? "x" : " "}$3`);
    setDraft(lines.join("\n"));
  };

  const taskLineIndexesInBlock = (block: MarkdownBlock) =>
    draft
      .slice(block.startOffset, block.endOffset)
      .split("\n")
      .map((line, index) => (TASK_LINE_RE.test(line) ? block.startLine + index : -1))
      .filter((index) => index >= 0);

  const markdownComponentsForTaskLines = (taskLineIndexes: number[], interactive: boolean) => {
    let renderedTaskInputIndex = 0;
    return {
      input({ type, checked, disabled: _disabled, ...props }: ComponentProps<"input">) {
        if (type !== "checkbox") return <input type={type} checked={checked} {...props} />;
        const lineIndex = taskLineIndexes[renderedTaskInputIndex];
        renderedTaskInputIndex += 1;
        if (!interactive || lineIndex === undefined) {
          return (
            <input
              {...props}
              type="checkbox"
              checked={Boolean(checked)}
              disabled
              onClick={(e) => e.stopPropagation()}
            />
          );
        }
        return (
          <input
            {...props}
            type="checkbox"
            checked={Boolean(checked)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => toggleTaskCheckboxAtLine(lineIndex, e.currentTarget.checked)}
          />
        );
      },
    };
  };

  const taskLineIndexesInText = (source: string, startLine: number) =>
    source
      .split("\n")
      .map((line, index) => (TASK_LINE_RE.test(line) ? startLine + index : -1))
      .filter((index) => index >= 0);

  const focusLineFromBlockClick = (block: MarkdownBlock, event: MouseEvent<HTMLElement>) => {
    const lineCount = Math.max(1, block.endLine - block.startLine + 1);
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
    const localLine = Math.min(lineCount - 1, Math.max(0, Math.floor(ratio * lineCount)));
    setActiveLineIndex(block.startLine + localLine);
  };

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
            onClick={() => applyMarkdownWrap("==", "==", "highlight")}
            className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            title="Highlight selection"
            aria-label="Highlight selection"
          >
            <Highlighter size={13} />
          </button>
          <button
            type="button"
            onClick={() => applyMarkdownWrap("<u>", "</u>", "underline")}
            className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            title="Underline selection"
            aria-label="Underline selection"
          >
            <Underline size={13} />
          </button>
          <button
            type="button"
            onClick={() => applyMarkdownWrap("~~", "~~", "strikethrough")}
            className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            title="Strikethrough selection"
            aria-label="Strikethrough selection"
          >
            <Strikethrough size={13} />
          </button>
          <button
            type="button"
            onClick={insertTaskCheckbox}
            className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            title="Insert checkbox task"
            aria-label="Insert checkbox task"
          >
            <ListChecks size={13} />
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

  const renderMarkdownSegment = (source: string, startLine: number, key: string) => {
    if (source.trim() === "") return null;
    return (
      <ReactMarkdown
        key={key}
        remarkPlugins={[remarkGfm, remarkMath, remarkHighlight, remarkUnderline]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponentsForTaskLines(taskLineIndexesInText(source, startLine), true)}
      >
        {normalizeMarkdownCodeDelimiters(source)}
      </ReactMarkdown>
    );
  };

  const renderMarkdownBlock = (block: MarkdownBlock) => {
    if (block.type === "blank") {
      return <div key={block.id} className="h-4" onClick={() => setActiveLineIndex(block.startLine)} />;
    }
    const activeInBlock =
      activeLineIndex !== null && activeLineIndex >= block.startLine && activeLineIndex <= block.endLine;

    if (activeInBlock && activeLine) {
      const blockLines = splitMarkdownLines(block.text);
      const localActiveLine = activeLineIndex - block.startLine;
      const beforeText = blockLines.slice(0, localActiveLine).map((line) => line.text).join("");
      const afterText = blockLines.slice(localActiveLine + 1).map((line) => line.text).join("");
      const activeLineText = plainLine(activeLine);

      return (
        <div
          key={block.id}
          onClick={(e) => focusLineFromBlockClick(block, e)}
          className="markdown-live-block px-3 py-1 -mx-3 cursor-text"
        >
          {renderMarkdownSegment(beforeText, block.startLine, `${block.id}-before`)}
          <textarea
            key={`${block.id}-${activeLineIndex}`}
            ref={textareaRef}
            autoFocus
            value={activeLineText}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => replaceLine(activeLine, e.target.value)}
            spellCheck={false}
            rows={Math.max(1, activeLineText.split("\n").length)}
            className="my-1 w-full resize-none border border-black dark:border-white bg-white dark:bg-black text-black dark:text-white font-mono text-sm leading-relaxed p-2 outline-none"
          />
          {renderMarkdownSegment(afterText, activeLineIndex + 1, `${block.id}-after`)}
        </div>
      );
    }

    return (
      <div
        key={block.id}
        onClick={(e) => focusLineFromBlockClick(block, e)}
        className="markdown-live-block px-3 py-1 -mx-3 cursor-text"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath, remarkHighlight, remarkUnderline]}
          rehypePlugins={[rehypeKatex]}
          components={markdownComponentsForTaskLines(taskLineIndexesInBlock(block), true)}
        >
          {normalizeMarkdownCodeDelimiters(block.text)}
        </ReactMarkdown>
      </div>
    );
  };

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
            {markdownBlocks.map(renderMarkdownBlock)}
          </div>
        ) : format === "md" ? (
          <div className={`md-body md-body-wide mx-auto ${markdownColumnClass}`}>
            {readerStatus?.startsWith("Read-only") && (
              <div className="mb-4 border border-black dark:border-white px-4 py-3 font-mono uppercase tracking-widest text-[10px]">
                {readerStatus} · open from Archiver to edit
              </div>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkHighlight, remarkUnderline]}
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
