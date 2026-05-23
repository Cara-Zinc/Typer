import { useEffect, useRef, useState } from "react";

// --- Keyboard layout ---
// Five rows, all uniform circle keys (matches the typewriter aesthetic).
// Long modifier names are replaced with Mac-style symbols:
//   shift → ⇧   caps lock → ⇪   tab → ⇥   return → ⏎   delete → ⌫
//   command → ⌘   option → ⌥   control → ⌃   arrows → ← ↑ ↓ →
// The spacebar is the only non-circle element (a long stadium).
const KEY_UNIT = 52; // horizontal slot per 1u key
const KEY_RADIUS = 22;
const SPACE_WIDTH_U = 5; // spacebar takes 5 slots

type KeyDef =
  | { kind: "circle"; label: string; data: string }
  | { kind: "space" };

const ROWS: ReadonlyArray<{ y: number; keys: KeyDef[] }> = [
  {
    y: 565,
    keys: [
      { kind: "circle", label: "`", data: "`" },
      { kind: "circle", label: "1", data: "1" },
      { kind: "circle", label: "2", data: "2" },
      { kind: "circle", label: "3", data: "3" },
      { kind: "circle", label: "4", data: "4" },
      { kind: "circle", label: "5", data: "5" },
      { kind: "circle", label: "6", data: "6" },
      { kind: "circle", label: "7", data: "7" },
      { kind: "circle", label: "8", data: "8" },
      { kind: "circle", label: "9", data: "9" },
      { kind: "circle", label: "0", data: "0" },
      { kind: "circle", label: "-", data: "-" },
      { kind: "circle", label: "=", data: "=" },
      { kind: "circle", label: "⌫", data: "Backspace" },
    ],
  },
  {
    y: 630,
    keys: [
      { kind: "circle", label: "⇥", data: "Tab" },
      { kind: "circle", label: "Q", data: "Q" },
      { kind: "circle", label: "W", data: "W" },
      { kind: "circle", label: "E", data: "E" },
      { kind: "circle", label: "R", data: "R" },
      { kind: "circle", label: "T", data: "T" },
      { kind: "circle", label: "Y", data: "Y" },
      { kind: "circle", label: "U", data: "U" },
      { kind: "circle", label: "I", data: "I" },
      { kind: "circle", label: "O", data: "O" },
      { kind: "circle", label: "P", data: "P" },
      { kind: "circle", label: "[", data: "[", },
      { kind: "circle", label: "]", data: "]", },
      { kind: "circle", label: "\\", data: "\\" },
    ],
  },
  {
    y: 695,
    keys: [
      { kind: "circle", label: "⇪", data: "CapsLock" },
      { kind: "circle", label: "A", data: "A" },
      { kind: "circle", label: "S", data: "S" },
      { kind: "circle", label: "D", data: "D" },
      { kind: "circle", label: "F", data: "F" },
      { kind: "circle", label: "G", data: "G" },
      { kind: "circle", label: "H", data: "H" },
      { kind: "circle", label: "J", data: "J" },
      { kind: "circle", label: "K", data: "K" },
      { kind: "circle", label: "L", data: "L" },
      { kind: "circle", label: ";", data: ";" },
      { kind: "circle", label: "'", data: "'" },
      { kind: "circle", label: "⏎", data: "Enter" },
    ],
  },
  {
    y: 760,
    keys: [
      { kind: "circle", label: "⇧", data: "ShiftL" },
      { kind: "circle", label: "Z", data: "Z" },
      { kind: "circle", label: "X", data: "X" },
      { kind: "circle", label: "C", data: "C" },
      { kind: "circle", label: "V", data: "V" },
      { kind: "circle", label: "B", data: "B" },
      { kind: "circle", label: "N", data: "N" },
      { kind: "circle", label: "M", data: "M" },
      { kind: "circle", label: ",", data: "," },
      { kind: "circle", label: ".", data: "." },
      { kind: "circle", label: "/", data: "/" },
      { kind: "circle", label: "⇧", data: "ShiftR" },
    ],
  },
  {
    y: 825,
    keys: [
      { kind: "circle", label: "fn", data: "Fn" },
      { kind: "circle", label: "⌃", data: "CtrlL" },
      { kind: "circle", label: "⌥", data: "AltL" },
      { kind: "circle", label: "⌘", data: "MetaL" },
      { kind: "space" },
      { kind: "circle", label: "⌘", data: "MetaR" },
      { kind: "circle", label: "⌥", data: "AltR" },
      { kind: "circle", label: "←", data: "ArrowLeft" },
      { kind: "circle", label: "↑", data: "ArrowUp" },
      { kind: "circle", label: "↓", data: "ArrowDown" },
      { kind: "circle", label: "→", data: "ArrowRight" },
    ],
  },
];

// Maps KeyboardEvent.code to the data-letter we used on the SVG key. This
// keeps the visual SVG decoupled from W3C key code naming.
const CODE_TO_DATA: Record<string, string> = {
  // Symbols
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  // Modifiers
  Tab: "Tab",
  CapsLock: "CapsLock",
  ShiftLeft: "ShiftL",
  ShiftRight: "ShiftR",
  Backspace: "Backspace",
  Enter: "Enter",
  ControlLeft: "CtrlL",
  ControlRight: "CtrlL",
  AltLeft: "AltL",
  AltRight: "AltR",
  MetaLeft: "MetaL",
  MetaRight: "MetaR",
  Fn: "Fn",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
};

const CARRIAGE_STEP = 4;
const CARRIAGE_WRAP = 28;

export function Typer() {
  const [text, setText] = useState("");
  const [animIndex, setAnimIndex] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const carriagePosRef = useRef(0);

  useEffect(() => {
    captureRef.current?.focus();
  }, []);

  // When the draft grows past the visible paper area, keep the bottom (where
  // the user is currently typing) in view. Triggered on text length changes.
  useEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [text.length]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const isSingleInsertion = next.length === text.length + 1;
    setText(next);
    if (isSingleInsertion) {
      setAnimIndex(e.target.selectionStart - 1);
      setAnimKey((k) => k + 1);
    } else if (next.length <= text.length) {
      setAnimIndex(null);
    }
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    if (!e.data || e.data.length === 0) return;
    const cursor = e.currentTarget.selectionStart;
    setAnimIndex(cursor - 1);
    setAnimKey((k) => k + 1);
  };

  const moveCarriage = (chars: number) => {
    const carriage = svgRef.current?.querySelector<SVGGElement>(".typer-carriage");
    if (!carriage) return;
    carriagePosRef.current = chars;
    const offset = -((chars % CARRIAGE_WRAP) * CARRIAGE_STEP);
    carriage.style.transform = `translateX(${offset}px)`;
  };

  const animateKeyEl = (el: SVGGElement) => {
    el.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(3px) scale(0.85)", offset: 0.4 },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 140, easing: "ease-out" },
    );
  };

  // Find a key whose data-letter exactly matches the given value, and play
  // the press animation on it. Returns true if a key was matched.
  const animateByData = (data: string): boolean => {
    const svg = svgRef.current;
    if (!svg) return false;
    const el = svg.querySelector<SVGGElement>(
      `.typer-key[data-letter="${CSS.escape(data)}"]`,
    );
    if (el) {
      animateKeyEl(el);
      return true;
    }
    return false;
  };

  // Fallback used during IME composition or for unmapped printables.
  const animateLetter = (raw: string) => {
    const svg = svgRef.current;
    if (!svg) return;
    const letter = raw.toUpperCase();
    if (animateByData(letter)) return;
    if (animateByData(raw)) return;
    // Last-resort deterministic fallback so the user gets some feedback.
    const all = svg.querySelectorAll<SVGGElement>(".typer-key");
    if (all.length > 0 && raw.length > 0) {
      animateKeyEl(all[raw.charCodeAt(0) % all.length]);
    }
  };

  const animateSpace = () => {
    const space = svgRef.current?.querySelector<SVGGElement>(".typer-space");
    space?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(3px)", offset: 0.4 },
        { transform: "translateY(0)" },
      ],
      { duration: 110, easing: "ease-out" },
    );
  };

  const animateLever = () => {
    const lever = svgRef.current?.querySelector<SVGGElement>(".typer-lever");
    lever?.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-32deg)", offset: 0.45 },
        { transform: "rotate(0deg)" },
      ],
      { duration: 380, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const code = e.code;

    // Special handling for keys with their own animation/carriage effect.
    if (code === "Enter") {
      animateLever();
      moveCarriage(0);
      animateByData("Enter");
      return;
    }
    if (code === "Space") {
      animateSpace();
      moveCarriage(carriagePosRef.current + 1);
      return;
    }
    if (code === "Backspace") {
      moveCarriage(Math.max(0, carriagePosRef.current - 1));
      animateByData("Backspace");
      return;
    }
    if (code === "Tab") {
      // Keep focus inside the textarea — don't let Tab move it to the next element.
      e.preventDefault();
      animateByData("Tab");
      return;
    }

    // Letters (KeyA…KeyZ).
    const letterMatch = code.match(/^Key([A-Z])$/);
    if (letterMatch) {
      animateByData(letterMatch[1]);
      moveCarriage(carriagePosRef.current + 1);
      return;
    }
    // Digits (Digit0…Digit9).
    const digitMatch = code.match(/^Digit(\d)$/);
    if (digitMatch) {
      animateByData(digitMatch[1]);
      moveCarriage(carriagePosRef.current + 1);
      return;
    }
    // Symbols and modifiers mapped through CODE_TO_DATA.
    const mapped = CODE_TO_DATA[code];
    if (mapped) {
      animateByData(mapped);
      // Symbol keys advance the carriage; modifiers do not.
      const isPrintableSymbol = mapped.length === 1 && !/[A-Z0-9]/.test(mapped);
      if (isPrintableSymbol) moveCarriage(carriagePosRef.current + 1);
      return;
    }
    // Final fallback for any single-char key not otherwise handled.
    if (e.key.length === 1) {
      animateLetter(e.key);
      moveCarriage(carriagePosRef.current + 1);
    }
  };

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  // Each row is centered horizontally so visually unequal-length rows still
  // sit balanced under the typebar basket.
  const renderRow = (row: { y: number; keys: KeyDef[] }) => {
    const totalUnits = row.keys.reduce(
      (sum, k) => sum + (k.kind === "space" ? SPACE_WIDTH_U : 1),
      0,
    );
    const totalWidth = totalUnits * KEY_UNIT;
    let cursorX = (1200 - totalWidth) / 2;

    return row.keys.map((k, idx) => {
      const w = k.kind === "space" ? SPACE_WIDTH_U : 1;
      const cellWidth = w * KEY_UNIT;
      const centerX = cursorX + cellWidth / 2;
      cursorX += cellWidth;

      if (k.kind === "space") {
        return (
          <g key={`${row.y}-${idx}-space`} transform={`translate(${centerX}, ${row.y})`}>
            <g className="typer-space">
              <rect
                x={-cellWidth / 2 + 6}
                y={-20}
                width={cellWidth - 12}
                height={40}
                rx="20"
                fill="white"
                stroke="black"
                strokeWidth="4"
              />
              <rect
                x={-cellWidth / 2 + 12}
                y={-14}
                width={cellWidth - 24}
                height={28}
                rx="14"
                fill="none"
                stroke="black"
                strokeWidth="2"
              />
            </g>
          </g>
        );
      }

      // Multi-char labels (only "fn") get a smaller class so they don't overflow.
      const labelCls =
        k.label.length > 1 && !/^[⇧⇪⇥⏎⌫⌘⌥⌃←↑↓→]$/.test(k.label)
          ? "key-text-small"
          : "key-text";

      return (
        <g key={`${row.y}-${idx}-${k.data}`} transform={`translate(${centerX}, ${row.y})`}>
          <g className="typer-key" data-letter={k.data}>
            <circle cx="0" cy="0" r={KEY_RADIUS} fill="white" stroke="black" strokeWidth="4" />
            <circle cx="0" cy="0" r={KEY_RADIUS - 6} fill="white" stroke="black" strokeWidth="2" />
            <text x="0" y="0" className={labelCls}>
              {k.label}
            </text>
          </g>
        </g>
      );
    });
  };

  return (
    <div className="grow flex flex-col bg-white dark:bg-black overflow-hidden relative">
      {/* Paper column — takes all space above the typewriter and scrolls
          internally as the draft grows. The typewriter SVG below has its
          own fixed-height region so the two never overlap. */}
      <div className="flex-1 min-h-0 flex justify-center px-6 pt-6">
        <div className="w-full max-w-3xl flex flex-col min-h-0">
          <div className="flex justify-between items-end mb-4 border-b-4 border-black dark:border-white pb-2 shrink-0">
            <span className="font-mono uppercase font-bold tracking-widest text-xl">Draft _</span>
            <span className="font-mono text-sm">Words: {wordCount}</span>
          </div>

          <div
            ref={paperRef}
            className="flex-1 min-h-0 overflow-y-auto cursor-text pb-6"
            onClick={() => captureRef.current?.focus()}
          >
            <div className="relative min-h-full font-mono text-lg leading-relaxed whitespace-pre-wrap break-words text-black dark:text-white">
              {text.length === 0 ? (
                <span className="text-black/30 dark:text-white/30">Start typing...</span>
              ) : (
                Array.from(text).map((ch, i) => {
                  // Newlines render as <br/> in outer flow. Wrapping a `\n`
                  // in a `display: inline-block` span (the strike animation)
                  // would make the break happen *inside* the inline-block,
                  // leaving the caret stranded on the previous line.
                  if (ch === "\n") return <br key={i} />;
                  return i === animIndex ? (
                    <span key={`a-${animKey}`} className="typer-char">
                      {ch}
                    </span>
                  ) : (
                    <span key={i}>{ch}</span>
                  );
                })
              )}
              <span className="typer-caret" aria-hidden="true" />

              <textarea
                ref={captureRef}
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onCompositionEnd={handleCompositionEnd}
                className="typer-capture font-mono text-lg leading-relaxed whitespace-pre-wrap break-words"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Typewriter SVG — pinned to the bottom of the app. The paper area
          above scrolls independently, so the SVG never covers text. */}
      <div className="w-full h-[55vh] min-h-[420px] max-h-[640px] flex justify-center items-end opacity-95 pointer-events-none shrink-0">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 1000"
          className="typer-svg h-full overflow-visible"
        >
          {/* Background */}
          <rect width="1200" height="1000" fill="white" />

          {/* Rear chassis (Straight orthogonal curves) */}
          <path
            d="M 160 380 C 160 320, 230 290, 400 290 L 800 290 C 970 290, 1040 320, 1040 380 L 1040 510 L 160 510 Z"
            fill="white"
            stroke="black"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <path
            d="M 175 380 C 175 330, 240 305, 400 305 L 800 305 C 960 305, 1025 330, 1025 380 L 1025 510 L 175 510 Z"
            fill="none"
            stroke="black"
            strokeWidth="2"
          />

          {/* Moving carriage assembly */}
          <g className="typer-carriage">
            <rect x="300" y="275" width="600" height="20" rx="10" fill="white" stroke="black" strokeWidth="4" />
            <line x1="310" y1="285" x2="890" y2="285" stroke="black" strokeWidth="2" />
            <rect x="290" y="240" width="620" height="55" rx="4" fill="white" stroke="black" strokeWidth="5" />
            <line x1="290" y1="250" x2="910" y2="250" stroke="black" strokeWidth="1.5" />
            <line x1="290" y1="285" x2="910" y2="285" stroke="black" strokeWidth="1.5" />
            <rect x="270" y="245" width="20" height="45" rx="3" fill="white" stroke="black" strokeWidth="4" />
            <circle cx="250" cy="267" r="32" fill="white" stroke="black" strokeWidth="4" />
            <circle cx="250" cy="267" r="26" fill="none" stroke="black" strokeWidth="2" strokeDasharray="3 4" />
            <circle cx="250" cy="267" r="18" fill="white" stroke="black" strokeWidth="3" />
            <circle cx="250" cy="267" r="6" fill="black" />
            <rect x="910" y="245" width="20" height="45" rx="3" fill="white" stroke="black" strokeWidth="4" />
            <circle cx="950" cy="267" r="32" fill="white" stroke="black" strokeWidth="4" />
            <circle cx="950" cy="267" r="26" fill="none" stroke="black" strokeWidth="2" strokeDasharray="3 4" />
            <circle cx="950" cy="267" r="18" fill="white" stroke="black" strokeWidth="3" />
            <circle cx="950" cy="267" r="6" fill="black" />
            <rect x="310" y="225" width="580" height="12" rx="6" fill="white" stroke="black" strokeWidth="4" />
            <line x1="330" y1="231" x2="870" y2="231" stroke="black" strokeWidth="3" strokeDasharray="6 8" />
            <rect x="420" y="215" width="24" height="32" rx="4" fill="white" stroke="black" strokeWidth="4" />
            <rect x="425" y="215" width="14" height="32" fill="none" stroke="black" strokeWidth="2" />
            <rect x="756" y="215" width="24" height="32" rx="4" fill="white" stroke="black" strokeWidth="4" />
            <rect x="761" y="215" width="14" height="32" fill="none" stroke="black" strokeWidth="2" />
          </g>

          {/* Carriage return lever */}
          <g className="typer-lever">
            <path
              d="M 270 260 Q 110 250 110 310 Q 110 340 130 340 Q 150 340 135 310 Q 120 280 270 285 Z"
              fill="white"
              stroke="black"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            <path
              d="M 270 266 Q 125 258 125 310 Q 125 325 135 325 Q 140 325 130 310 Q 125 285 270 279 Z"
              fill="none"
              stroke="black"
              strokeWidth="1.5"
            />
          </g>

          {/* Ribbon spools */}
          <g transform="translate(360, 420)">
            <circle cx="0" cy="0" r="55" fill="white" stroke="black" strokeWidth="5" />
            <circle cx="0" cy="0" r="48" fill="none" stroke="black" strokeWidth="2" />
            <path
              d="M 0 -55 L 0 55 M -55 0 L 55 0 M -39 -39 L 39 39 M -39 39 L 39 -39"
              stroke="black"
              strokeWidth="4"
            />
            <circle cx="0" cy="0" r="20" fill="white" stroke="black" strokeWidth="4" />
            <circle cx="0" cy="0" r="6" fill="black" />
          </g>
          <g transform="translate(840, 420)">
            <circle cx="0" cy="0" r="55" fill="white" stroke="black" strokeWidth="5" />
            <circle cx="0" cy="0" r="48" fill="none" stroke="black" strokeWidth="2" />
            <path
              d="M 0 -55 L 0 55 M -55 0 L 55 0 M -39 -39 L 39 39 M -39 39 L 39 -39"
              stroke="black"
              strokeWidth="4"
            />
            <circle cx="0" cy="0" r="20" fill="white" stroke="black" strokeWidth="4" />
            <circle cx="0" cy="0" r="6" fill="black" />
          </g>

          {/* Ribbon tape */}
          <path
            d="M 360 420 Q 480 350 585 260 L 615 260 Q 720 350 840 420"
            fill="none"
            stroke="black"
            strokeWidth="8"
          />

          {/* Ribbon & strike guide */}
          <path
            d="M 585 270 L 585 240 L 575 220 L 585 220 L 595 240 L 605 240 L 615 220 L 625 220 L 615 240 L 615 270 Z"
            fill="white"
            stroke="black"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M 592 245 L 608 245 M 592 255 L 608 255 M 600 245 L 600 270"
            fill="none"
            stroke="black"
            strokeWidth="2"
          />

          {/* Main front chassis (Now purely orthogonal / flat rectangle) */}
          <rect
            x="120"
            y="510"
            width="960"
            height="380"
            rx="8"
            fill="white"
            stroke="black"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <rect
            x="135"
            y="522"
            width="930"
            height="356"
            rx="4"
            fill="none"
            stroke="black"
            strokeWidth="2"
          />

          {/* Keyboard deck (Remains perfectly horizontal/orthogonal as before) */}
          <rect
            x="165"
            y="525"
            width="870"
            height="345"
            rx="14"
            fill="white"
            stroke="black"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <rect
            x="178"
            y="536"
            width="844"
            height="323"
            rx="10"
            fill="none"
            stroke="black"
            strokeWidth="2"
          />

          {/* Typebars (basket) */}
          <path
            d="M 370 510 C 370 560, 830 560, 830 510"
            fill="none"
            stroke="black"
            strokeWidth="6"
          />
          <g fill="none" stroke="black" strokeWidth="2">
            <path d="M 390 510 Q 500 400 595 270" />
            <path d="M 420 520 Q 510 405 596 270" />
            <path d="M 450 527 Q 520 410 597 270" />
            <path d="M 480 532 Q 530 415 598 270" />
            <path d="M 510 535 Q 545 420 599 270" />
            <path d="M 540 537 Q 565 425 600 270" />
            <path d="M 570 538 Q 585 430 600 270" />
            <path d="M 600 539 Q 600 430 600 270" />
            <path d="M 630 538 Q 615 430 600 270" />
            <path d="M 660 537 Q 635 425 600 270" />
            <path d="M 690 535 Q 655 420 601 270" />
            <path d="M 720 532 Q 670 415 602 270" />
            <path d="M 750 527 Q 680 410 603 270" />
            <path d="M 780 520 Q 690 405 604 270" />
            <path d="M 810 510 Q 700 400 605 270" />
          </g>

          {/* Keyboard rows */}
          {ROWS.map((row) => renderRow(row))}

          {/* Front lip (Now perfectly orthogonal as well) */}
          <rect
            x="120"
            y="890"
            width="960"
            height="35"
            rx="4"
            fill="white"
            stroke="black"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <rect
            x="135"
            y="898"
            width="930"
            height="19"
            rx="2"
            fill="none"
            stroke="black"
            strokeWidth="2"
          />

          {/* Brand decal */}
          <text x="600" y="475" className="brand-text">
            CORONA
          </text>
          <text x="600" y="495" className="sub-brand">
            STANDARD TYPEWRITER CO.
          </text>
        </svg>
      </div>
    </div>
  );
}