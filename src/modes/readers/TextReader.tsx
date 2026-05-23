import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
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
};

const FORMAT_LABEL: Record<TextFormat, string> = {
  md: "Markdown",
  txt: "Plain Text",
  json: "JSON",
  yaml: "YAML",
};

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
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
  }, [formattedText, text]);

  const pageBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.9 * dir, behavior: "smooth" });
  };

  const themeClass = theme === "dark" ? "reader-dark" : "";

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
        ) : format === "md" ? (
          <div className="md-body max-w-3xl mx-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkHighlight]}
              rehypePlugins={[rehypeKatex]}
            >
              {text}
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
