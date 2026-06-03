import { Bookmark, Highlighter, Trash2, Underline } from "lucide-react";
import type { ReaderAnnotation } from "../../state/ReaderAnnotationsContext";

type Props = {
  annotations: ReaderAnnotation[];
  onJump?: (annotation: ReaderAnnotation) => void;
  onRemove?: (annotationId: string) => void;
};

function iconFor(kind: ReaderAnnotation["kind"]) {
  if (kind === "highlight") return <Highlighter size={13} />;
  if (kind === "underline") return <Underline size={13} />;
  return <Bookmark size={13} />;
}

function locatorLabel(annotation: ReaderAnnotation) {
  if (annotation.locator.type === "pdf") {
    return annotation.kind === "bookmark"
      ? `Page ${annotation.locator.page}`
      : `Page ${annotation.locator.page} · ${annotation.locator.rects.length} mark${annotation.locator.rects.length === 1 ? "" : "s"}`;
  }
  return annotation.kind === "bookmark" ? "EPUB bookmark" : "EPUB CFI";
}

export function AnnotationList({ annotations, onJump, onRemove }: Props) {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-black text-black dark:text-white">
      <div className="px-4 py-3 border-b border-black dark:border-white font-mono uppercase tracking-widest text-[10px]">
        Annotations · {annotations.length}
      </div>
      {annotations.length === 0 ? (
        <div className="p-4 font-serif italic text-sm opacity-60">No marks yet.</div>
      ) : (
        <div className="overflow-auto">
          {annotations.map((annotation) => (
            <div key={annotation.id} className="border-b border-black dark:border-white">
              <button
                type="button"
                onClick={() => onJump?.(annotation)}
                className="w-full text-left px-4 py-3 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
              >
                <div className="font-mono uppercase tracking-widest text-[9px] opacity-70 flex items-center gap-2">
                  {iconFor(annotation.kind)}
                  {annotation.kind} · {locatorLabel(annotation)}
                </div>
                {annotation.quote && (
                  <div className="mt-2 font-serif text-sm leading-snug line-clamp-4">
                    {annotation.quote}
                  </div>
                )}
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(annotation.id)}
                  className="w-full px-4 py-2 border-t border-black/30 dark:border-white/30 font-mono uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
