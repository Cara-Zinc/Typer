import { useEffect, useRef, useState } from "react";
import { ReaderShell, type ReaderTheme, type SplitMode } from "./ReaderShell";

type Props = {
  html: string;
  fileName: string;
  formatLabel: string;
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

export function HtmlReader({
  html,
  fileName,
  formatLabel,
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
  }, [html]);

  const pageBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.9 * dir, behavior: "smooth" });
  };

  const themeClass = theme === "dark" ? "reader-dark" : "";

  return (
    <ReaderShell
      title={fileName}
      location={formatLabel}
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
        <div
          className="md-body max-w-3xl mx-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </ReaderShell>
  );
}
