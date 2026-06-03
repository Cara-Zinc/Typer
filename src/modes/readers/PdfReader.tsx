import { useEffect, useRef, useState } from "react";
import { Bookmark, Highlighter, Underline } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ReaderShell, type ReaderTheme, type SplitMode } from "./ReaderShell";
import { AnnotationList } from "./AnnotationList";
import type {
  PdfAnnotationRect,
  ReaderAnnotation,
  ReaderAnnotationKind,
  ReaderAnnotationLocator,
} from "../../state/ReaderAnnotationsContext";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

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

export function PdfReader({
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState(fileName);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ quote: string; rects: PdfAnnotationRect[] } | null>(null);

  // Load the document.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    // pdfjs mutates the buffer it's given, so hand it a copy to keep our prop stable.
    const copy = buffer.slice(0);
    const task = pdfjs.getDocument({ data: copy });
    task.promise
      .then(async (d) => {
        if (cancelled) {
          d.destroy();
          return;
        }
        setDoc(d);
        setPage(1);
        try {
          const meta = await d.getMetadata();
          const info = meta.info as { Title?: string } | undefined;
          if (info?.Title) setTitle(info.Title);
        } catch {
          /* keep filename as fallback */
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[PdfReader] getDocument failed", err);
        setError(`Could not open PDF: ${err?.message ?? err}`);
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [buffer]);

  // Render the active page; re-render on container resize.
  useEffect(() => {
    if (!doc || !canvasRef.current || !containerRef.current || !textLayerRef.current) return;
    let cancelled = false;
    let currentRender: RenderTask | null = null;

    const render = async () => {
      try {
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const container = containerRef.current;
        const canvas = canvasRef.current;
        const textLayer = textLayerRef.current;
        if (!container || !canvas || !textLayer) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const padding = 32;
        const cw = Math.max(0, container.clientWidth - padding);
        const ch = Math.max(0, container.clientHeight - padding);
        if (cw === 0 || ch === 0) return;

        const fit = Math.min(cw / baseViewport.width, ch / baseViewport.height);
        const dpr = window.devicePixelRatio || 1;
        // fontScale doubles as a zoom factor for PDFs (rasterized content).
        const cssViewport = pdfPage.getViewport({ scale: fit * fontScale });
        const viewport = pdfPage.getViewport({ scale: fit * dpr * fontScale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;
        setPageSize({ width: cssViewport.width, height: cssViewport.height });

        textLayer.replaceChildren();
        textLayer.style.width = `${cssViewport.width}px`;
        textLayer.style.height = `${cssViewport.height}px`;

        currentRender?.cancel();
        currentRender = pdfPage.render({ canvasContext: ctx, viewport });
        await currentRender.promise;

        const textContent = await pdfPage.getTextContent();
        if (cancelled) return;
        const layer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport: cssViewport,
        });
        await layer.render();
      } catch (err) {
        const name = (err as { name?: string } | null)?.name ?? "";
        if (name === "RenderingCancelledException") return;
        console.error("[PdfReader] render failed", err);
        setError(`Render failed: ${(err as Error)?.message ?? err}`);
      }
    };

    render();
    const ro = new ResizeObserver(() => render());
    ro.observe(containerRef.current);
    return () => {
      cancelled = true;
      ro.disconnect();
      textLayerRef.current?.replaceChildren();
    };
  }, [doc, page, fontScale]);

  // Cleanup the document when the buffer changes.
  useEffect(() => {
    return () => {
      doc?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const total = doc?.numPages ?? 0;
  const progress = total > 0 ? page / total : 0;

  const annotationsOnPage = annotations.filter(
    (annotation) => annotation.locator.type === "pdf" && annotation.locator.page === page,
  );

  const captureSelection = () => {
    if (!annotationsEnabled || !pageBoxRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setPendingSelection(null);
      return;
    }
    const quote = selection.toString().trim();
    const pageRect = pageBoxRef.current.getBoundingClientRect();
    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects())
      .map((rect) => {
        const left = Math.max(0, Math.min(1, (rect.left - pageRect.left) / pageRect.width));
        const top = Math.max(0, Math.min(1, (rect.top - pageRect.top) / pageRect.height));
        const right = Math.max(0, Math.min(1, (rect.right - pageRect.left) / pageRect.width));
        const bottom = Math.max(0, Math.min(1, (rect.bottom - pageRect.top) / pageRect.height));
        return { left, top, width: right - left, height: bottom - top };
      })
      .filter((rect) => rect.width > 0.002 && rect.height > 0.002);
    if (!quote || rects.length === 0) return;
    setPendingSelection({ quote, rects });
  };

  const addFromSelection = async (kind: Extract<ReaderAnnotationKind, "highlight" | "underline">) => {
    if (!pendingSelection || !onAddAnnotation) return;
    await onAddAnnotation(
      kind,
      { type: "pdf", page, rects: pendingSelection.rects },
      pendingSelection.quote,
    );
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const addBookmark = async () => {
    if (!onAddAnnotation) return;
    await onAddAnnotation("bookmark", { type: "pdf", page, rects: [] }, `Page ${page}`);
  };

  const canvasBorder = theme === "dark" ? "border-white" : "border-black";
  // CSS invert for dark mode — PDFs are pre-rendered raster, so we flip colors at display time.
  const canvasFilter = theme === "dark" ? "grayscale contrast-105 invert" : "grayscale contrast-105";

  return (
    <ReaderShell
      title={title}
      location={total > 0 ? `Page ${page} / ${total}` : "Loading…"}
      progress={progress}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (doc ? Math.min(doc.numPages, p + 1) : p))}
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
              className="p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
              title="Bookmark page"
              aria-label="Bookmark page"
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
              if (annotation.locator.type === "pdf") setPage(annotation.locator.page);
            }}
            onRemove={(id) => void onRemoveAnnotation?.(id)}
          />
        ) : undefined
      }
    >
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-auto px-8 py-4"
      >
        {/* grid place-items-center keeps the canvas centered when it fits,
            and lets it overflow into scrollbars when fontScale zooms past 100%. */}
        <div className="min-h-full min-w-full grid place-items-center">
          <div
            ref={pageBoxRef}
            onMouseUp={captureSelection}
            className={`relative border ${canvasBorder} ${error ? "hidden" : ""}`}
            style={pageSize ? { width: pageSize.width, height: pageSize.height } : undefined}
          >
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 ${canvasFilter}`}
            />
            <div ref={textLayerRef} className="pdf-text-layer" />
            <div className="absolute inset-0 pointer-events-none">
              {annotationsOnPage.map((annotation) =>
                annotation.locator.type === "pdf"
                  ? annotation.locator.rects.map((rect, i) => (
                    <div
                      key={`${annotation.id}-${i}`}
                      className={annotation.kind === "underline" ? "pdf-annotation-underline" : "pdf-annotation-highlight"}
                      style={{
                        left: `${rect.left * 100}%`,
                        top: `${rect.top * 100}%`,
                        width: `${rect.width * 100}%`,
                        height: `${rect.height * 100}%`,
                      }}
                    />
                  ))
                  : null,
              )}
            </div>
          </div>
        </div>
        {error && (
          <div className={`absolute max-w-md p-4 border ${canvasBorder} font-mono text-xs whitespace-pre-wrap`}>
            <span className="font-bold block mb-1">Error</span>
            {error}
          </div>
        )}
      </div>
    </ReaderShell>
  );
}
