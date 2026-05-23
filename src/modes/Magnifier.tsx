import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, exists, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import ePub, { type Book, type NavItem } from "epubjs";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  Layers,
  X,
} from "lucide-react";

// The Magnifier shares vault state with the Archiver via this localStorage key.
const VAULT_PREF_KEY = "triptych.archiver.vaultPath";

// What a leaf in the tree points at. EPUB leaves point at a spine slot, text
// leaves point at a character range in the raw source string.
type PartRef =
  | { kind: "epub-spine"; spineIndex: number }
  | { kind: "text-range"; start: number; end: number };

type TocNode = {
  id: string;
  label: string;
  ref: PartRef | null; // null = grouping node (root, or a branch with no own slice)
  children: TocNode[];
  expanded: boolean;
};

type TextFormat = "md" | "txt";

type TextStrategy =
  | { kind: "headings"; depth: number } // 1..3 — md only
  | { kind: "regex"; pattern: string };

type EpubSource = {
  kind: "epub";
  path: string;
  fileName: string;
  title: string;
  book: Book;
  root: TocNode;
};

type TextSource = {
  kind: "text";
  format: TextFormat;
  path: string;
  fileName: string;
  title: string;
  raw: string;
  strategy: TextStrategy;
  root: TocNode;
};

type Source = EpubSource | TextSource;

type PreviewState = {
  nodeId: string;
  title: string;
  text: string;
} | null;

type ExtractState =
  | { phase: "idle" }
  | { phase: "running"; done: number; total: number }
  | { phase: "done"; written: number; dir: string }
  | { phase: "error"; message: string };

const DEFAULT_TXT_REGEX =
  "^(CHAPTER\\s+[IVXLCDM\\d]+.*|Chapter\\s+[IVXLCDM\\d]+.*|第.+?[章节回].*)$";
const DEFAULT_MD_REGEX = "^#+\\s+(.+)$";

async function readBuffer(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

// Filesystem-safe slug. Keeps CJK so Chinese chapter titles stay readable.
function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^\w一-鿿\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return slug || "untitled";
}

// -------- EPUB tree builders (unchanged from step 1) -------------------------

function buildTocTree(
  book: Book,
  items: NavItem[],
  ids: { n: number } = { n: 0 },
): TocNode[] {
  return items.map((item) => {
    const baseHref = (item.href ?? "").split("#")[0];
    let spineIndex = -1;
    try {
      const section = book.spine.get(baseHref);
      if (section && typeof (section as { index?: number }).index === "number") {
        spineIndex = (section as { index: number }).index;
      }
    } catch {
      /* unresolved href */
    }
    const sub = item.subitems ?? [];
    return {
      id: `t${++ids.n}`,
      label: (item.label ?? "").trim() || `Section ${spineIndex + 1}`,
      ref: spineIndex >= 0 ? { kind: "epub-spine", spineIndex } : null,
      children: sub.length > 0 ? buildTocTree(book, sub, ids) : [],
      expanded: false,
    };
  });
}

function buildFlatSpineTree(book: Book): TocNode[] {
  const spine = book.spine as unknown as {
    spineItems?: Array<{ idref?: string }>;
    items?: Array<{ idref?: string }>;
  };
  const items = spine.spineItems ?? spine.items ?? [];
  return items.map((s, i) => ({
    id: `s${i}`,
    label: s.idref ? s.idref : `Section ${i + 1}`,
    ref: { kind: "epub-spine", spineIndex: i },
    children: [],
    expanded: false,
  }));
}

async function loadEpubSource(path: string): Promise<EpubSource> {
  const buffer = await readBuffer(path);
  const book = ePub(buffer);
  await book.ready;
  const meta = await book.loaded.metadata;
  await book.loaded.spine;
  const nav = await book.loaded.navigation;
  const fileName = path.split("/").pop() ?? "Untitled";
  const title = (meta?.title ?? "").trim() || fileName.replace(/\.[^.]+$/, "");
  const tocChildren =
    nav.toc && nav.toc.length > 0 ? buildTocTree(book, nav.toc) : buildFlatSpineTree(book);
  const root: TocNode = {
    id: "root",
    label: title,
    ref: null,
    children: tocChildren,
    expanded: true,
  };
  return { kind: "epub", path, fileName, title, book, root };
}

function parseLoadedDoc(result: unknown): string {
  if (typeof result === "string") {
    const parsed = new DOMParser().parseFromString(result, "text/html");
    return parsed.body?.textContent?.trim() ?? "";
  }
  const doc = result as Document | null;
  if (doc?.body && typeof doc.body.textContent === "string") {
    return doc.body.textContent.trim();
  }
  if (doc?.documentElement?.textContent) {
    return doc.documentElement.textContent.trim();
  }
  return "";
}

async function extractSpineText(book: Book, spineIndex: number): Promise<string> {
  const section = book.spine.get(spineIndex) as unknown as
    | { url?: string; href?: string; load?: (req: unknown) => Promise<unknown> }
    | null;
  if (!section) return "";
  if (typeof section.load === "function") {
    try {
      const result = await section.load(book.load.bind(book));
      const text = parseLoadedDoc(result);
      if (text) return text;
    } catch {
      /* fall through */
    }
  }
  const url = section.url ?? section.href;
  if (!url) return "";
  const result = await book.load(url);
  return parseLoadedDoc(result);
}

// -------- Text tree builders -------------------------------------------------

type Heading = { level: number; title: string; index: number };

function parseHeadings(raw: string, maxDepth: number): Heading[] {
  const out: Heading[] = [];
  const lines = raw.split("\n");
  let pos = 0;
  for (const line of lines) {
    // ATX headings only: `# `, `## `, ..., `###### `. Closed `#`s are trimmed.
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m && m[1].length <= maxDepth) {
      out.push({ level: m[1].length, title: m[2].trim(), index: pos });
    }
    pos += line.length + 1; // newline
  }
  return out;
}

// Build a nested tree from headings up to the given depth. Each node's range
// runs from its heading line to the start of the next heading at level <=
// its own (or EOF). Branch ranges contain their children's ranges; leaves
// are non-overlapping.
function buildHeadingTree(
  raw: string,
  depth: number,
  ids: { n: number },
): TocNode[] {
  const heads = parseHeadings(raw, depth);
  if (heads.length === 0) {
    return [
      {
        id: `h${++ids.n}`,
        label: "Whole file",
        ref: { kind: "text-range", start: 0, end: raw.length },
        children: [],
        expanded: false,
      },
    ];
  }
  const ends = heads.map((h, i) => {
    for (let j = i + 1; j < heads.length; j++) {
      if (heads[j].level <= h.level) return heads[j].index;
    }
    return raw.length;
  });

  type Tmp = {
    id: string;
    label: string;
    ref: PartRef;
    children: Tmp[];
    expanded: boolean;
    level: number;
  };
  const roots: Tmp[] = [];
  const stack: Tmp[] = [];

  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    const node: Tmp = {
      id: `h${++ids.n}`,
      label: h.title || `Section ${i + 1}`,
      ref: { kind: "text-range", start: h.index, end: ends[i] },
      children: [],
      expanded: false,
      level: h.level,
    };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  const strip = (n: Tmp): TocNode => ({
    id: n.id,
    label: n.label,
    ref: n.ref,
    children: n.children.map(strip),
    expanded: n.children.length > 0,
  });
  return roots.map(strip);
}

// Flat list: one part per regex match. Optionally prepends a "(Frontmatter)"
// part for content before the first match so nothing is silently dropped.
function buildRegexTree(
  raw: string,
  pattern: string,
  ids: { n: number },
): TocNode[] {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "gm");
  } catch (e) {
    throw new Error(`Invalid regex: ${e instanceof Error ? e.message : String(e)}`);
  }
  const matches: Array<{ index: number; label: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    const label = (m[1] ?? m[0]).trim().slice(0, 80);
    matches.push({ index: m.index, label });
    if (m.index === regex.lastIndex) regex.lastIndex++; // zero-width guard
  }
  if (matches.length === 0) {
    return [
      {
        id: `r${++ids.n}`,
        label: "No matches — whole file",
        ref: { kind: "text-range", start: 0, end: raw.length },
        children: [],
        expanded: false,
      },
    ];
  }
  const nodes: TocNode[] = [];
  if (matches[0].index > 0) {
    nodes.push({
      id: `r${++ids.n}`,
      label: "(Frontmatter)",
      ref: { kind: "text-range", start: 0, end: matches[0].index },
      children: [],
      expanded: false,
    });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    nodes.push({
      id: `r${++ids.n}`,
      label: matches[i].label || `Part ${i + 1}`,
      ref: { kind: "text-range", start, end },
      children: [],
      expanded: false,
    });
  }
  return nodes;
}

function buildTextRoot(
  raw: string,
  title: string,
  strategy: TextStrategy,
): TocNode {
  const ids = { n: 0 };
  let children: TocNode[];
  if (strategy.kind === "headings") {
    children = buildHeadingTree(raw, strategy.depth, ids);
  } else {
    children = buildRegexTree(raw, strategy.pattern, ids);
  }
  return {
    id: "root",
    label: title,
    ref: null,
    children,
    expanded: true,
  };
}

async function loadTextSource(path: string): Promise<TextSource> {
  const buffer = await readBuffer(path);
  const raw = new TextDecoder("utf-8", { fatal: false })
    .decode(buffer)
    .replace(/^﻿/, "");
  const fileName = path.split("/").pop() ?? "Untitled";
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const format: TextFormat = ext === "md" || ext === "markdown" ? "md" : "txt";
  const title = fileName.replace(/\.[^.]+$/, "");
  const strategy: TextStrategy =
    format === "md"
      ? { kind: "headings", depth: 2 }
      : { kind: "regex", pattern: DEFAULT_TXT_REGEX };
  const root = buildTextRoot(raw, title, strategy);
  return { kind: "text", format, path, fileName, title, raw, strategy, root };
}

// -------- Generic helpers ----------------------------------------------------

function updateNode(node: TocNode, id: string, mut: (n: TocNode) => TocNode): TocNode {
  if (node.id === id) return mut(node);
  return { ...node, children: node.children.map((c) => updateNode(c, id, mut)) };
}

function collectLeaves(node: TocNode): TocNode[] {
  if (node.children.length === 0) return node.ref ? [node] : [];
  return node.children.flatMap(collectLeaves);
}

async function extractRefText(source: Source, ref: PartRef): Promise<string> {
  if (source.kind === "epub" && ref.kind === "epub-spine") {
    return extractSpineText(source.book, ref.spineIndex);
  }
  if (source.kind === "text" && ref.kind === "text-range") {
    return source.raw.slice(ref.start, ref.end).trim();
  }
  return "";
}

function refKey(ref: PartRef): string {
  return ref.kind === "epub-spine" ? `s${ref.spineIndex}` : `r${ref.start}-${ref.end}`;
}

function refFrontmatter(ref: PartRef): string {
  return ref.kind === "epub-spine"
    ? `spineIndex: ${ref.spineIndex}`
    : `range: "chars:${ref.start}-${ref.end}"`;
}

// -------- Component ----------------------------------------------------------

export function Magnifier() {
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [extracting, setExtracting] = useState<ExtractState>({ phase: "idle" });
  // Draft for the regex input — committed to source.strategy on Apply so we
  // don't rebuild the tree on every keystroke (and so invalid intermediate
  // patterns don't spam errors).
  const [regexDraft, setRegexDraft] = useState<string>("");

  const openSource = useCallback(async () => {
    setError(null);
    try {
      const path = await open({
        filters: [{ name: "Source", extensions: ["epub", "md", "markdown", "txt"] }],
        multiple: false,
      });
      if (!path || typeof path !== "string") return;
      setLoading(true);
      const ext = (path.split(".").pop() ?? "").toLowerCase();
      const src: Source =
        ext === "epub" ? await loadEpubSource(path) : await loadTextSource(path);
      setSource(src);
      setSelectedId(src.root.id);
      setPreview(null);
      setExtracting({ phase: "idle" });
      if (src.kind === "text" && src.strategy.kind === "regex") {
        setRegexDraft(src.strategy.pattern);
      } else {
        setRegexDraft("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const closeSource = () => {
    setSource(null);
    setSelectedId(null);
    setPreview(null);
    setError(null);
    setExtracting({ phase: "idle" });
    setRegexDraft("");
  };

  const toggleExpand = useCallback((id: string) => {
    setSource((prev) =>
      prev
        ? { ...prev, root: updateNode(prev.root, id, (n) => ({ ...n, expanded: !n.expanded })) }
        : prev,
    );
  }, []);

  const handleNodeClick = useCallback(
    async (node: TocNode) => {
      setSelectedId(node.id);
      if (node.children.length > 0) {
        toggleExpand(node.id);
        return;
      }
      if (!node.ref || !source) {
        setPreview(null);
        return;
      }
      setPreviewLoading(true);
      try {
        const text = await extractRefText(source, node.ref);
        setPreview({ nodeId: node.id, title: node.label, text });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPreviewLoading(false);
      }
    },
    [source, toggleExpand],
  );

  // ---- Strategy controls (text sources only) --------------------------------

  const setTextStrategy = useCallback((strategy: TextStrategy) => {
    setSource((prev) => {
      if (!prev || prev.kind !== "text") return prev;
      try {
        const root = buildTextRoot(prev.raw, prev.title, strategy);
        return { ...prev, strategy, root };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return prev;
      }
    });
    setSelectedId("root");
    setPreview(null);
  }, []);

  const onStrategyKindChange = (kind: "headings" | "regex") => {
    if (!source || source.kind !== "text") return;
    if (kind === "headings") {
      setTextStrategy({ kind: "headings", depth: 2 });
    } else {
      const pattern =
        source.format === "md" ? DEFAULT_MD_REGEX : DEFAULT_TXT_REGEX;
      setRegexDraft(pattern);
      setTextStrategy({ kind: "regex", pattern });
    }
  };

  const onDepthChange = (depth: number) => {
    setTextStrategy({ kind: "headings", depth });
  };

  const onRegexApply = () => {
    setTextStrategy({ kind: "regex", pattern: regexDraft });
  };

  // ---- Extraction -----------------------------------------------------------

  const prepareExtraction = useCallback(async () => {
    if (!source) return null;
    const vault = (() => {
      try {
        return localStorage.getItem(VAULT_PREF_KEY);
      } catch {
        return null;
      }
    })();
    if (!vault) {
      setExtracting({
        phase: "error",
        message:
          "No vault connected. Open the Archiver tab and connect a folder before extracting.",
      });
      return null;
    }
    // Dedupe leaves by ref identity so duplicate TOC anchors / overlapping
    // headings don't write the same file twice.
    const seen = new Set<string>();
    const orderedLeaves = collectLeaves(source.root).filter((leaf) => {
      if (!leaf.ref) return false;
      const key = refKey(leaf.ref);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (orderedLeaves.length === 0) {
      setExtracting({
        phase: "error",
        message: "No extractable parts found.",
      });
      return null;
    }
    const bookSlug = slugify(source.title);
    const outDir = `${vault}/.triptych/extracts/${bookSlug}`;
    try {
      if (!(await exists(outDir))) {
        await mkdir(outDir, { recursive: true });
      }
    } catch (e) {
      setExtracting({
        phase: "error",
        message: `Could not prepare output folder: ${e instanceof Error ? e.message : String(e)}`,
      });
      return null;
    }
    return { orderedLeaves, outDir };
  }, [source]);

  const writeLeaf = useCallback(
    async (leaf: TocNode, partIndex: number, totalLeaves: number, outDir: string) => {
      if (!source || !leaf.ref) return null;
      const text = await extractRefText(source, leaf.ref);
      const pad = String(totalLeaves).length;
      const fileName = `${String(partIndex).padStart(pad, "0")}-${slugify(leaf.label)}.md`;
      const filePath = `${outDir}/${fileName}`;
      const body = [
        "---",
        `source: ${JSON.stringify(source.fileName)}`,
        `part: ${partIndex}`,
        `title: ${JSON.stringify(leaf.label)}`,
        refFrontmatter(leaf.ref),
        `extractedAt: ${new Date().toISOString()}`,
        "---",
        "",
        `# ${leaf.label}`,
        "",
        text,
        "",
      ].join("\n");
      await writeTextFile(filePath, body);
      return fileName;
    },
    [source],
  );

  const handleExtractAll = useCallback(async () => {
    const prep = await prepareExtraction();
    if (!prep) return;
    const { orderedLeaves, outDir } = prep;
    setExtracting({ phase: "running", done: 0, total: orderedLeaves.length });
    let written = 0;
    for (let i = 0; i < orderedLeaves.length; i++) {
      const leaf = orderedLeaves[i];
      try {
        const result = await writeLeaf(leaf, i + 1, orderedLeaves.length, outDir);
        if (result) written++;
        setExtracting({ phase: "running", done: i + 1, total: orderedLeaves.length });
      } catch (e) {
        console.error("extract failed for", leaf.label, e);
      }
    }
    setExtracting({ phase: "done", written, dir: outDir });
  }, [prepareExtraction, writeLeaf]);

  const handleExtractOne = useCallback(
    async (leaf: TocNode) => {
      const prep = await prepareExtraction();
      if (!prep || !leaf.ref) return;
      const { orderedLeaves, outDir } = prep;
      const myKey = refKey(leaf.ref);
      const partIndex =
        orderedLeaves.findIndex((n) => n.ref && refKey(n.ref) === myKey) + 1;
      if (partIndex === 0) {
        setExtracting({ phase: "error", message: "That part isn't in the extractable list." });
        return;
      }
      setExtracting({ phase: "running", done: 0, total: 1 });
      try {
        await writeLeaf(leaf, partIndex, orderedLeaves.length, outDir);
        setExtracting({ phase: "done", written: 1, dir: outDir });
      } catch (e) {
        setExtracting({
          phase: "error",
          message: `Extract failed: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    },
    [prepareExtraction, writeLeaf],
  );

  // Where extracts for the current source *will* land. Computed lazily from
  // the saved vault path so we can show it before any extraction has happened.
  const projectedOutDir: string | null = (() => {
    if (!source) return null;
    let vault: string | null;
    try {
      vault = localStorage.getItem(VAULT_PREF_KEY);
    } catch {
      vault = null;
    }
    if (!vault) return null;
    return `${vault}/.triptych/extracts/${slugify(source.title)}`;
  })();

  const revealInFinder = useCallback(async (path: string) => {
    try {
      // Confirm the folder exists first — opening a non-existent path errors
      // out on macOS and the message is opaque.
      if (!(await exists(path))) {
        setError(
          `Nothing to reveal yet — ${path} doesn't exist. Extract something first.`,
        );
        return;
      }
      await openPath(path);
    } catch (e) {
      setError(`Could not open folder: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const previewLeaf: TocNode | null = (() => {
    if (!source || !preview) return null;
    const find = (node: TocNode): TocNode | null => {
      if (node.id === preview.nodeId) return node;
      for (const c of node.children) {
        const f = find(c);
        if (f) return f;
      }
      return null;
    };
    return find(source.root);
  })();

  const renderNode = (node: TocNode, depth = 0) => {
    const isRoot = node.id === "root";
    const hasChildren = node.children.length > 0;
    const isSelected = selectedId === node.id;
    const isExtractable = node.ref !== null;

    return (
      <div key={node.id} className="font-mono">
        <div
          className={`flex items-center gap-2 py-1 pr-3 cursor-pointer transition-colors select-none ${
            isSelected
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
          }`}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          onClick={() => handleNodeClick(node)}
        >
          <span className="shrink-0 inline-flex w-4 justify-center">
            {hasChildren ? (
              node.expanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : null}
          </span>

          {isRoot ? (
            <BookOpen size={16} className="shrink-0" />
          ) : hasChildren ? (
            node.expanded ? (
              <FolderOpen size={16} className="shrink-0" />
            ) : (
              <Folder size={16} className="shrink-0" />
            )
          ) : (
            <FileText
              size={16}
              className={`shrink-0 ${isExtractable ? "" : "opacity-40"}`}
            />
          )}

          <span
            className={
              isRoot || hasChildren
                ? "font-bold uppercase tracking-wider text-xs truncate"
                : `text-sm truncate ${isExtractable ? "" : "opacity-50"}`
            }
          >
            {node.label}
          </span>
        </div>

        {hasChildren && node.expanded && (
          <>{node.children.map((c) => renderNode(c, depth + 1))}</>
        )}
      </div>
    );
  };

  const partCount = source
    ? new Set(
        collectLeaves(source.root)
          .filter((n) => n.ref)
          .map((n) => refKey(n.ref!)),
      ).size
    : 0;

  // ---- Strategy panel (varies by source kind) -------------------------------

  const renderStrategyCard = () => {
    if (!source) return null;
    if (source.kind === "epub") {
      return (
        <div className="border border-black dark:border-white p-3">
          <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60 mb-1">
            Strategy
          </div>
          <div className="font-mono text-sm">Spine items (TOC order)</div>
          <div className="font-mono text-[0.6rem] opacity-60 mt-1">
            {partCount} extractable part{partCount === 1 ? "" : "s"}
          </div>
        </div>
      );
    }
    const isMd = source.format === "md";
    const strat = source.strategy;
    return (
      <div className="border border-black dark:border-white p-3 flex flex-col gap-2">
        <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60">
          Strategy
        </div>
        <div className="flex border border-black dark:border-white overflow-hidden text-xs font-mono uppercase tracking-widest">
          {isMd && (
            <button
              onClick={() => onStrategyKindChange("headings")}
              className={`flex-1 py-1 ${
                strat.kind === "headings"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
              }`}
            >
              Headings
            </button>
          )}
          <button
            onClick={() => onStrategyKindChange("regex")}
            className={`flex-1 py-1 ${
              !isMd ? "border-l-0" : "border-l border-black dark:border-white"
            } ${
              strat.kind === "regex"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            }`}
          >
            Regex
          </button>
        </div>

        {strat.kind === "headings" && (
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60">
              Depth
            </span>
            <div className="flex border border-black dark:border-white overflow-hidden text-xs font-mono">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  onClick={() => onDepthChange(d)}
                  className={`px-2 py-0.5 ${
                    d > 1 ? "border-l border-black dark:border-white" : ""
                  } ${
                    strat.depth === d
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                  }`}
                  title={`Split on H1${d >= 2 ? "/H2" : ""}${d >= 3 ? "/H3" : ""}`}
                >
                  H{d}
                </button>
              ))}
            </div>
          </div>
        )}

        {strat.kind === "regex" && (
          <div className="flex flex-col gap-1 mt-1">
            <span className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60">
              Pattern (multiline, capture group → title)
            </span>
            <input
              type="text"
              value={regexDraft}
              onChange={(e) => setRegexDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRegexApply();
              }}
              spellCheck={false}
              className="bg-transparent border border-black dark:border-white px-2 py-1 font-mono text-xs outline-none focus:bg-black focus:text-white dark:focus:bg-white dark:focus:text-black"
              placeholder={DEFAULT_TXT_REGEX}
            />
            <button
              onClick={onRegexApply}
              className="border border-black dark:border-white py-1 font-mono uppercase tracking-widest text-[0.65rem] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            >
              Apply
            </button>
          </div>
        )}

        <div className="font-mono text-[0.6rem] opacity-60 mt-1">
          {partCount} extractable part{partCount === 1 ? "" : "s"}
        </div>
      </div>
    );
  };

  const sourceLabelKind = source
    ? source.kind === "epub"
      ? "EPUB"
      : source.format === "md"
        ? "MARKDOWN"
        : "TEXT"
    : "";

  return (
    <div className="grow flex h-full overflow-hidden bg-white dark:bg-black text-black dark:text-white">
      {/* Left: source actions + strategy */}
      <div className="w-1/3 border-r border-black dark:border-white flex flex-col">
        <div className="p-4 bg-black text-white dark:bg-white dark:text-black font-mono uppercase text-sm tracking-widest flex items-center gap-2 shrink-0">
          <Layers size={16} /> Splitter
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          <p className="font-serif text-sm leading-relaxed">
            Split a book or document into part files written under
            <span className="font-mono"> .triptych/extracts/</span> in your connected vault.
            Supports <span className="font-mono">.epub</span>,{" "}
            <span className="font-mono">.md</span>, and{" "}
            <span className="font-mono">.txt</span>.
          </p>

          {!source ? (
            <button
              onClick={openSource}
              disabled={loading}
              className="w-full border-2 border-black dark:border-white py-3 font-mono uppercase tracking-widest text-sm font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
            >
              <BookOpen size={18} /> {loading ? "Loading…" : "Open Source"}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="border border-black dark:border-white p-3 break-all">
                <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60 mb-1 flex justify-between gap-2">
                  <span>Source</span>
                  <span>{sourceLabelKind}</span>
                </div>
                <div className="font-serif text-sm leading-snug">{source.title}</div>
                <div className="font-mono text-[0.6rem] opacity-60 mt-1 truncate">
                  {source.fileName}
                </div>
              </div>

              {renderStrategyCard()}

              {projectedOutDir && (
                <div className="border border-black dark:border-white p-3 flex flex-col gap-1">
                  <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60">
                    Output folder
                  </div>
                  <div className="font-mono text-[0.65rem] opacity-80 break-all leading-snug">
                    {projectedOutDir}
                  </div>
                  <button
                    onClick={() => revealInFinder(projectedOutDir)}
                    className="self-start mt-1 border border-black dark:border-white px-2 py-0.5 font-mono uppercase tracking-widest text-[0.6rem] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center gap-1"
                    title="Open this folder in Finder"
                  >
                    <ExternalLink size={11} /> Reveal in Finder
                  </button>
                </div>
              )}

              <button
                onClick={handleExtractAll}
                disabled={extracting.phase === "running"}
                className="w-full border-2 border-black dark:border-white py-2 font-mono uppercase tracking-widest text-xs font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download size={14} />
                {extracting.phase === "running"
                  ? `Extracting ${extracting.done}/${extracting.total}…`
                  : "Extract All to Vault"}
              </button>
              <button
                onClick={openSource}
                className="w-full border border-black dark:border-white py-2 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
              >
                Switch source…
              </button>
              <button
                onClick={closeSource}
                className="w-full border border-black dark:border-white py-2 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center justify-center gap-2"
              >
                <X size={12} /> Close
              </button>
            </div>
          )}

          {extracting.phase === "done" && (
            <div className="p-3 border border-black dark:border-white font-mono text-xs flex flex-col gap-2">
              <div className="font-bold uppercase">
                Wrote {extracting.written} file{extracting.written === 1 ? "" : "s"}
              </div>
              <div className="opacity-60 break-all">{extracting.dir}</div>
              <button
                onClick={() => revealInFinder(extracting.dir)}
                className="self-start border border-black dark:border-white px-2 py-0.5 font-mono uppercase tracking-widest text-[0.6rem] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center gap-1"
              >
                <ExternalLink size={11} /> Reveal in Finder
              </button>
            </div>
          )}
          {extracting.phase === "error" && (
            <div className="p-3 border border-black dark:border-white font-mono text-xs whitespace-pre-wrap">
              <div className="font-bold uppercase mb-1">Notice</div>
              {extracting.message}
            </div>
          )}
          {error && (
            <div className="p-3 border border-black dark:border-white font-mono text-xs whitespace-pre-wrap">
              <div className="font-bold uppercase mb-1">Error</div>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Right: tree + preview */}
      <div className="w-2/3 flex flex-col bg-white dark:bg-black min-h-0">
        <div className="p-4 border-b border-black dark:border-white font-mono text-xs tracking-widest flex justify-between items-center shrink-0 gap-4">
          <span className="truncate">
            {source ? `SOURCE: ${source.title}` : "No source loaded"}
          </span>
          {source && (
            <span className="opacity-60">
              {partCount} part{partCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="flex grow min-h-0">
          {/* Tree */}
          <div className="w-1/2 border-r border-black dark:border-white overflow-y-auto p-4">
            {source ? (
              <div className="border border-black dark:border-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                {renderNode(source.root)}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center font-mono text-sm opacity-50 p-8">
                <BookOpen size={48} className="mb-4 opacity-50" />
                <p>Open a source on the left to see its part tree here.</p>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="w-1/2 overflow-y-auto p-6">
            {previewLoading ? (
              <div className="h-full flex items-center justify-center font-mono text-sm opacity-60">
                Loading preview…
              </div>
            ) : preview ? (
              <div className="space-y-3">
                <div className="border-b border-black dark:border-white pb-2 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60">
                      Preview
                    </div>
                    <div className="font-serif text-lg leading-snug truncate">{preview.title}</div>
                  </div>
                  {previewLeaf && previewLeaf.ref && (
                    <button
                      onClick={() => handleExtractOne(previewLeaf)}
                      disabled={extracting.phase === "running"}
                      className="shrink-0 border border-black dark:border-white px-3 py-1 font-mono uppercase tracking-widest text-[0.65rem] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center gap-1 disabled:opacity-50"
                      title="Write only this part to the vault"
                    >
                      <Download size={12} /> Extract this
                    </button>
                  )}
                </div>
                <div className="font-serif text-base leading-relaxed whitespace-pre-wrap break-words">
                  {preview.text ? (
                    preview.text
                  ) : (
                    <span className="opacity-50 italic">— empty part —</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center font-mono text-sm opacity-50 text-center p-4">
                {source
                  ? "Click a part in the tree to preview its extracted text."
                  : "Preview will appear here."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
