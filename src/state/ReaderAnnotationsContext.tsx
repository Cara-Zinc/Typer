import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export type ReaderAnnotationKind = "highlight" | "underline" | "bookmark";

export type EpubAnnotationLocator = {
  type: "epub";
  cfiRange: string;
};

export type PdfAnnotationRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PdfAnnotationLocator = {
  type: "pdf";
  page: number;
  rects: PdfAnnotationRect[];
};

export type ReaderAnnotationLocator = EpubAnnotationLocator | PdfAnnotationLocator;

export type ReaderAnnotation = {
  id: string;
  kind: ReaderAnnotationKind;
  locator: ReaderAnnotationLocator;
  quote?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReaderDocumentAnnotationMeta = {
  documentKey: string;
  relativePath: string;
  fileName: string;
  format: string;
};

type ReaderDocumentAnnotations = ReaderDocumentAnnotationMeta & {
  items: ReaderAnnotation[];
};

type ReaderAnnotationsFile = {
  version: 1;
  documents: Record<string, ReaderDocumentAnnotations>;
};

type NewReaderAnnotation = {
  kind: ReaderAnnotationKind;
  locator: ReaderAnnotationLocator;
  quote?: string;
};

type ReaderAnnotationsContextValue = {
  loadDocument: (vaultRoot: string, meta: ReaderDocumentAnnotationMeta) => Promise<ReaderAnnotation[]>;
  addAnnotation: (
    vaultRoot: string,
    meta: ReaderDocumentAnnotationMeta,
    annotation: NewReaderAnnotation,
  ) => Promise<ReaderAnnotation | null>;
  removeAnnotation: (
    vaultRoot: string,
    meta: ReaderDocumentAnnotationMeta,
    annotationId: string,
  ) => Promise<void>;
};

const EMPTY_FILE: ReaderAnnotationsFile = { version: 1, documents: {} };
const ReaderAnnotationsContext = createContext<ReaderAnnotationsContextValue | null>(null);

function vaultAnnotationsPath(vaultRoot: string) {
  return `${vaultRoot}/.triptych/reader-annotations.json`;
}

function vaultMetadataDir(vaultRoot: string) {
  return `${vaultRoot}/.triptych`;
}

async function readAnnotationsFile(vaultRoot: string): Promise<ReaderAnnotationsFile> {
  const path = vaultAnnotationsPath(vaultRoot);
  if (!(await exists(path))) return { ...EMPTY_FILE, documents: {} };
  try {
    const raw = await readTextFile(path);
    const parsed = JSON.parse(raw) as Partial<ReaderAnnotationsFile>;
    if (parsed.version !== 1 || !parsed.documents || typeof parsed.documents !== "object") {
      return { ...EMPTY_FILE, documents: {} };
    }
    return { version: 1, documents: parsed.documents as Record<string, ReaderDocumentAnnotations> };
  } catch {
    return { ...EMPTY_FILE, documents: {} };
  }
}

async function writeAnnotationsFile(vaultRoot: string, body: ReaderAnnotationsFile) {
  const dir = vaultMetadataDir(vaultRoot);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  await writeTextFile(vaultAnnotationsPath(vaultRoot), JSON.stringify(body, null, 2));
}

function freshId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ReaderAnnotationsProvider({ children }: { children: ReactNode }) {
  const writeLocksRef = useRef<Record<string, Promise<void>>>({});

  const loadDocument = useCallback(
    async (vaultRoot: string, meta: ReaderDocumentAnnotationMeta) => {
      const file = await readAnnotationsFile(vaultRoot);
      const record = file.documents[meta.documentKey];
      return record?.items ?? [];
    },
    [],
  );

  const withWriteLock = useCallback(
    async <T,>(vaultRoot: string, write: (file: ReaderAnnotationsFile) => Promise<T>) => {
      let resolveWrite!: () => void;
      const next = new Promise<void>((resolve) => {
        resolveWrite = resolve;
      });
      const prev = writeLocksRef.current[vaultRoot] ?? Promise.resolve();
      writeLocksRef.current[vaultRoot] = next;
      await prev;
      try {
        const file = await readAnnotationsFile(vaultRoot);
        return await write(file);
      } finally {
        resolveWrite();
      }
    },
    [],
  );

  const addAnnotation = useCallback(
    async (
      vaultRoot: string,
      meta: ReaderDocumentAnnotationMeta,
      annotation: NewReaderAnnotation,
    ) =>
      withWriteLock(vaultRoot, async (file) => {
        const now = new Date().toISOString();
        const nextAnnotation: ReaderAnnotation = {
          id: freshId(),
          ...annotation,
          createdAt: now,
          updatedAt: now,
        };
        const existing = file.documents[meta.documentKey] ?? { ...meta, items: [] };
        file.documents[meta.documentKey] = {
          ...existing,
          ...meta,
          items: [...existing.items, nextAnnotation],
        };
        await writeAnnotationsFile(vaultRoot, file);
        return nextAnnotation;
      }).catch(() => null),
    [withWriteLock],
  );

  const removeAnnotation = useCallback(
    async (vaultRoot: string, meta: ReaderDocumentAnnotationMeta, annotationId: string) => {
      await withWriteLock(vaultRoot, async (file) => {
        const existing = file.documents[meta.documentKey];
        if (!existing) return;
        file.documents[meta.documentKey] = {
          ...existing,
          ...meta,
          items: existing.items.filter((item) => item.id !== annotationId),
        };
        await writeAnnotationsFile(vaultRoot, file);
      }).catch(() => undefined);
    },
    [withWriteLock],
  );

  return (
    <ReaderAnnotationsContext.Provider value={{ loadDocument, addAnnotation, removeAnnotation }}>
      {children}
    </ReaderAnnotationsContext.Provider>
  );
}

export function useReaderAnnotations() {
  const ctx = useContext(ReaderAnnotationsContext);
  if (!ctx) throw new Error("useReaderAnnotations must be used inside ReaderAnnotationsProvider");
  return ctx;
}
