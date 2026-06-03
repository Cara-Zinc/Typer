import { useEffect, useRef, useState } from "react";
import { Bookmark, Highlighter, Underline } from "lucide-react";
import ePub, { type Rendition, type NavItem, type Location } from "epubjs";
import { ReaderShell, type ReaderTheme, type SplitMode } from "./ReaderShell";
import { AnnotationList } from "./AnnotationList";
import type {
  ReaderAnnotation,
  ReaderAnnotationKind,
  ReaderAnnotationLocator,
} from "../../state/ReaderAnnotationsContext";

type Props = {
  buffer: ArrayBuffer;
  fileName: string;
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
  annotationsEnabled?: boolean;
  annotations?: ReaderAnnotation[];
  onAddAnnotation?: (
    kind: ReaderAnnotationKind,
    locator: ReaderAnnotationLocator,
    quote?: string,
  ) => Promise<ReaderAnnotation | null>;
  onRemoveAnnotation?: (annotationId: string) => Promise<void>;
};

function findInToc(toc: NavItem[], href: string): NavItem | null {
  const base = href.split("#")[0];
  for (const item of toc) {
    const itemBase = item.href.split("#")[0];
    if (item.href === href || itemBase === base) return item;
    if (item.subitems) {
      const found = findInToc(item.subitems, href);
      if (found) return found;
    }
  }
  return null;
}

const SERIF_STACK =
  "'Iowan Old Style', 'Palatino Linotype', Georgia, Garamond, serif !important";

function themeRules(theme: ReaderTheme) {
  const fg = theme === "dark" ? "#ffffff" : "#000000";
  const bg = theme === "dark" ? "#000000" : "#ffffff";
  return {
    body: {
      background: `${bg} !important`,
      color: `${fg} !important`,
      "font-family": SERIF_STACK,
      margin: "0 !important",
      padding: "0 !important",
    },
    "p, div, span, li, blockquote": {
      color: `${fg} !important`,
      "line-height": "1.7 !important",
    },
    "h1, h2, h3, h4, h5, h6": {
      color: `${fg} !important`,
      "font-family": SERIF_STACK,
    },
    a: { color: `${fg} !important`, "text-decoration": "underline !important" },
    img: { "max-width": "100% !important", filter: "grayscale(1) contrast(1.05)" },
    "::selection": { background: `${fg} !important`, color: `${bg} !important` },
  } as const;
}

export function EpubReader({
  buffer,
  fileName,
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
  annotationsEnabled = false,
  annotations = [],
  onAddAnnotation,
  onRemoveAnnotation,
}: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [title, setTitle] = useState(fileName);
  const [chapter, setChapter] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ cfiRange: string; quote: string } | null>(null);

  const applyAnnotation = (annotation: ReaderAnnotation) => {
    const r = renditionRef.current;
    if (!r || annotation.locator.type !== "epub") return;
    const styles = annotation.kind === "highlight"
      ? { fill: theme === "dark" ? "#555" : "#d8d8d8", "fill-opacity": "0.9" }
      : { stroke: theme === "dark" ? "#fff" : "#000", "stroke-opacity": "0.75" };
    if (annotation.kind === "highlight") {
      r.annotations.highlight(annotation.locator.cfiRange, { id: annotation.id }, undefined, "triptych-epub-highlight", styles);
    } else if (annotation.kind === "underline") {
      r.annotations.underline(annotation.locator.cfiRange, { id: annotation.id }, undefined, "triptych-epub-underline", styles);
    } else {
      r.annotations.mark(annotation.locator.cfiRange, { id: annotation.id });
    }
  };

  const addFromSelection = async (kind: Extract<ReaderAnnotationKind, "highlight" | "underline">) => {
    if (!pendingSelection || !onAddAnnotation) return;
    const annotation = await onAddAnnotation(
      kind,
      { type: "epub", cfiRange: pendingSelection.cfiRange },
      pendingSelection.quote,
    );
    if (annotation) applyAnnotation(annotation);
    setPendingSelection(null);
  };

  const addBookmark = async () => {
    if (!currentCfi || !onAddAnnotation) return;
    const annotation = await onAddAnnotation(
      "bookmark",
      { type: "epub", cfiRange: currentCfi },
      chapter || title,
    );
    if (annotation) applyAnnotation(annotation);
  };

  const removeEpubAnnotation = async (annotation: ReaderAnnotation) => {
    if (annotation.locator.type === "epub") {
      const type = annotation.kind === "bookmark" ? "mark" : annotation.kind;
      renditionRef.current?.annotations.remove(annotation.locator.cfiRange, type);
    }
    await onRemoveAnnotation?.(annotation.id);
  };

  useEffect(() => {
    if (!viewerRef.current) return;
    const book = ePub(buffer);
    let mounted = true;

    const r = book.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: "none",
      allowScriptedContent: false,
    });
    renditionRef.current = r;

    r.themes.register("triptych-light", themeRules("light"));
    r.themes.register("triptych-dark", themeRules("dark"));
    r.themes.select(theme === "dark" ? "triptych-dark" : "triptych-light");
    r.themes.fontSize(`${Math.round(fontScale * 110)}%`);
    r.display();

    book.loaded.metadata.then((meta) => {
      if (mounted && meta.title) setTitle(meta.title);
    });

    book.ready
      .then(() => book.locations.generate(1500))
      .catch(() => {
        /* progress is best-effort */
      });

    r.on("relocated", (location: Location) => {
      if (!mounted) return;
      setCurrentCfi(location.start.cfi);
      const href = location.start.href;
      const found = findInToc(book.navigation.toc, href);
      if (found) setChapter(found.label.trim());
      try {
        if (book.locations.length() > 0) {
          setProgress(book.locations.percentageFromCfi(location.start.cfi));
        }
      } catch {
        /* ignore */
      }
    });

    r.on("selected", (cfiRange: string, contents: { window?: Window }) => {
      if (!annotationsEnabled) return;
      const quote = contents.window?.getSelection()?.toString().trim() ?? "";
      if (!quote) return;
      setPendingSelection({ cfiRange, quote });
      contents.window?.getSelection()?.removeAllRanges();
    });

    const onIframeKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") r.next();
      if (e.key === "ArrowLeft") r.prev();
    };
    r.on("keyup", onIframeKey);

    return () => {
      mounted = false;
      r.destroy();
      renditionRef.current = null;
    };
  }, [buffer]);

  // Apply theme / font-size to the live rendition without re-creating it.
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    r.themes.select(theme === "dark" ? "triptych-dark" : "triptych-light");
  }, [theme]);

  useEffect(() => {
    if (!renditionRef.current || !annotationsEnabled) return;
    annotations.forEach(applyAnnotation);
  }, [annotations, annotationsEnabled, theme]);

  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    r.themes.fontSize(`${Math.round(fontScale * 110)}%`);
  }, [fontScale]);

  return (
    <ReaderShell
      title={title}
      location={chapter}
      progress={progress}
      onPrev={() => renditionRef.current?.prev()}
      onNext={() => renditionRef.current?.next()}
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
      toolbarExtra={
        annotationsEnabled ? (
          <div className="flex items-center gap-1 border border-black dark:border-white px-1 py-0.5">
            {pendingSelection && (
              <>
                <button
                  type="button"
                  onClick={() => void addFromSelection("highlight")}
                  className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                  title="Highlight selection"
                  aria-label="Highlight selection"
                >
                  <Highlighter size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => void addFromSelection("underline")}
                  className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                  title="Underline selection"
                  aria-label="Underline selection"
                >
                  <Underline size={13} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => void addBookmark()}
              disabled={!currentCfi}
              className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black disabled:opacity-30"
              title="Bookmark location"
              aria-label="Bookmark location"
            >
              <Bookmark size={13} />
            </button>
          </div>
        ) : null
      }
      annotationCount={annotations.length}
      annotationsPanel={
        annotationsEnabled ? (
          <AnnotationList
            annotations={annotations}
            onJump={(annotation) => {
              if (annotation.locator.type === "epub") renditionRef.current?.display(annotation.locator.cfiRange);
            }}
            onRemove={(id) => {
              const annotation = annotations.find((item) => item.id === id);
              if (annotation) void removeEpubAnnotation(annotation);
            }}
          />
        ) : undefined
      }
    >
      <div ref={viewerRef} className="absolute inset-0 px-16 py-6" />
    </ReaderShell>
  );
}
