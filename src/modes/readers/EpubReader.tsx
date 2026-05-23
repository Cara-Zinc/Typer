import { useEffect, useRef, useState } from "react";
import ePub, { type Rendition, type NavItem, type Location } from "epubjs";
import { ReaderShell, type ReaderTheme, type SplitMode } from "./ReaderShell";

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
}: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [title, setTitle] = useState(fileName);
  const [chapter, setChapter] = useState("");
  const [progress, setProgress] = useState(0);

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
    >
      <div ref={viewerRef} className="absolute inset-0 px-16 py-6" />
    </ReaderShell>
  );
}
