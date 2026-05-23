import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ReaderShell, type ReaderTheme, type SplitMode } from "./ReaderShell";

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
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState(fileName);
  const [error, setError] = useState<string | null>(null);

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
    if (!doc || !canvasRef.current || !containerRef.current) return;
    let cancelled = false;
    let currentRender: RenderTask | null = null;

    const render = async () => {
      try {
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const padding = 32;
        const cw = Math.max(0, container.clientWidth - padding);
        const ch = Math.max(0, container.clientHeight - padding);
        if (cw === 0 || ch === 0) return;

        const fit = Math.min(cw / baseViewport.width, ch / baseViewport.height);
        const dpr = window.devicePixelRatio || 1;
        // fontScale doubles as a zoom factor for PDFs (rasterized content).
        const viewport = pdfPage.getViewport({ scale: fit * dpr * fontScale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        currentRender?.cancel();
        currentRender = pdfPage.render({ canvasContext: ctx, viewport });
        await currentRender.promise;
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
    >
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-auto px-8 py-4"
      >
        {/* grid place-items-center keeps the canvas centered when it fits,
            and lets it overflow into scrollbars when fontScale zooms past 100%. */}
        <div className="min-h-full min-w-full grid place-items-center">
          <canvas
            ref={canvasRef}
            className={`border ${canvasBorder} ${canvasFilter} ${error ? "hidden" : ""}`}
          />
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
