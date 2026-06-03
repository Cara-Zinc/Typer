// items.tsx — Starter furniture catalog.
//
// 16 pieces, each a self-contained registerFurniture({…}) block. Add
// items by copying any block, changing id/name/size/render, and saving
// the file — the registry picks them up on next reload.
//
// Hard constraint: SVG primitives only (rect / circle / ellipse / line /
// rotated rect = diamond). No paths.

import { registerFurniture } from "./registry";

function inks(dark: boolean): { ink: string; bg: string } {
  return dark ? { ink: "#fff", bg: "#000" } : { ink: "#000", bg: "#fff" };
}

// ── 1 · Bookshelf — fills with pages read ─────────────────────────────
registerFurniture({
  id: "bookshelf",
  name: "Bookshelf",
  category: "storage",
  anchor: "floor",
  size: { w: 120, h: 230 },
  price: 80,
  description: "Visible books scale with pages read this week.",
  render: ({ dark, state }) => {
    const { ink, bg } = inks(dark);
    const totalBooks = Math.min(28, Math.max(4, Math.floor(state.pagesRead / 4) + 6));
    const shelves = 4;
    const perShelf = Math.ceil(totalBooks / shelves);
    return (
      <svg viewBox="0 0 120 230" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="2" y="2" width="116" height="226" fill={bg} stroke={ink} strokeWidth="2" />
        {[58, 114, 170, 220].map((y, i) => (
          <line key={i} x1="2" y1={y} x2="118" y2={y} stroke={ink} strokeWidth="2" />
        ))}
        {Array.from({ length: shelves }).flatMap((_, shelfIdx) => {
          const top = 4 + shelfIdx * 56;
          const visible = Math.min(perShelf, Math.max(0, totalBooks - shelfIdx * perShelf));
          return Array.from({ length: visible }).map((_, b) => {
            const x = 6 + b * 9;
            const h = 50 - (b % 3) * 4;
            return (
              <rect key={`${shelfIdx}-${b}`} x={x} y={top + (52 - h)} width="7" height={h} fill={bg} stroke={ink} strokeWidth="1.2" />
            );
          });
        })}
        <rect x="-2" y="226" width="124" height="4" fill={ink} />
      </svg>
    );
  },
});

// ── 2 · Writing desk — typewriter + paper stack from words written ────
registerFurniture({
  id: "desk",
  name: "Writing Desk",
  category: "surface",
  anchor: "floor",
  size: { w: 180, h: 110 },
  price: 100,
  description: "A solid oak desk with a typewriter and a stack of pages.",
  render: ({ dark, state }) => {
    const { ink, bg } = inks(dark);
    const pages = Math.min(8, Math.floor(state.words / 250));
    return (
      <svg viewBox="0 0 180 110" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="2" y="36" width="176" height="10" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="14" y="46" width="152" height="22" fill={bg} stroke={ink} strokeWidth="2" />
        <circle cx="90" cy="57" r="2" fill={ink} />
        <rect x="6" y="68" width="10" height="40" fill={ink} />
        <rect x="164" y="68" width="10" height="40" fill={ink} />
        <rect x="58" y="14" width="58" height="22" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="64" y="6" width="46" height="10" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="86" y="2" width="20" height="6" fill={bg} stroke={ink} strokeWidth="1.5" />
        {[68, 78, 88, 98, 108].map((x, i) => (<circle key={i} cx={x} cy="28" r="1.5" fill={ink} />))}
        {Array.from({ length: pages }).map((_, i) => (
          <rect key={i} x={124 + (i % 2)} y={32 - i * 2} width="22" height="3" fill={bg} stroke={ink} strokeWidth="0.8" />
        ))}
      </svg>
    );
  },
});

// ── 3 · Reading chair ─────────────────────────────────────────────────
registerFurniture({
  id: "chair",
  name: "Reading Chair",
  category: "seating",
  anchor: "floor",
  size: { w: 100, h: 140 },
  price: 60,
  description: "A high-back armchair. The pet may claim it.",
  render: ({ dark }) => {
    const { ink, bg } = inks(dark);
    return (
      <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="4"  y="2"  width="22" height="120" fill={bg} stroke={ink} strokeWidth="2" />
        <line x1="4" y1="14" x2="26" y2="14" stroke={ink} strokeWidth="1" />
        <rect x="26" y="60" width="68" height="14" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="26" y="74" width="68" height="36" fill={bg} stroke={ink} strokeWidth="2" />
        <line x1="32" y1="80" x2="88" y2="80" stroke={ink} strokeWidth="1" opacity="0.6" />
        <rect x="28" y="110" width="6" height="22" fill={ink} />
        <rect x="86" y="110" width="6" height="22" fill={ink} />
      </svg>
    );
  },
});

// ── 4 · Fireplace — flame tier from streak ────────────────────────────
registerFurniture({
  id: "fireplace",
  name: "Fireplace",
  category: "decor",
  anchor: "floor",
  size: { w: 150, h: 180 },
  price: 240,
  description: "Burns brighter with every day of your streak.",
  render: ({ dark, accent, state }) => {
    const { ink, bg } = inks(dark);
    const streak = state.streak;
    const tier = streak <= 0 ? 0 : streak <= 2 ? 1 : streak <= 5 ? 2 : streak <= 13 ? 3 : 4;
    const flameColor = streak > 0 ? (accent ?? ink) : ink;
    return (
      <svg viewBox="0 0 150 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="-4" y="30"  width="158" height="14"  fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="6"  y="44"  width="138" height="120" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="28" y="62"  width="94"  height="102" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="-4" y="164" width="158" height="14"  fill={bg} stroke={ink} strokeWidth="2" />
        {tier >= 1 && (
          <>
            <rect x="40" y="148" width="32" height="6" fill={ink} />
            <rect x="76" y="142" width="32" height="6" fill={ink} />
          </>
        )}
        {tier >= 1 && <rect x="68" y="128" width="14" height="14" fill={flameColor} transform="rotate(45 75 135)" />}
        {tier >= 2 && (
          <>
            <rect x="54" y="124" width="10" height="10" fill={flameColor} transform="rotate(45 59 129)" />
            <rect x="86" y="124" width="10" height="10" fill={flameColor} transform="rotate(45 91 129)" />
          </>
        )}
        {tier >= 3 && <rect x="62" y="106" width="18" height="18" fill={flameColor} transform="rotate(45 71 115)" />}
        {tier >= 4 && (
          <>
            <rect x="46" y="98" width="10" height="10" fill={flameColor} transform="rotate(45 51 103)" />
            <rect x="92" y="98" width="10" height="10" fill={flameColor} transform="rotate(45 97 103)" />
          </>
        )}
        <circle cx="75" cy="22" r="6" fill={bg} stroke={ink} strokeWidth="1.5" />
        <line x1="75" y1="22" x2="75" y2="18" stroke={ink} strokeWidth="1" />
      </svg>
    );
  },
});

// ── 5 · Tall window — sky reflects time of day ────────────────────────
registerFurniture({
  id: "window",
  name: "Tall Window",
  category: "window",
  anchor: "wall",
  size: { w: 96, h: 170 },
  price: 0,
  description: "Sky outside changes with the hour.",
  render: ({ dark, state }) => {
    const { ink, bg } = inks(dark);
    const phase = state.dayPhase;
    const sunMoonY = phase === "night" ? 36 : phase === "dawn" ? 110 : phase === "dusk" ? 110 : 50;
    return (
      <svg viewBox="0 0 96 170" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="2" y="2" width="92" height="166" fill={bg} stroke={ink} strokeWidth="2" />
        <line x1="48" y1="2" x2="48" y2="168" stroke={ink} strokeWidth="2" />
        <line x1="2"  y1="84" x2="94" y2="84"  stroke={ink} strokeWidth="2" />
        <circle cx="64" cy={sunMoonY} r="9" fill={bg} stroke={ink} strokeWidth="1.5" />
        {phase === "night" && <circle cx="60" cy={sunMoonY - 2} r="4" fill={bg} />}
        {phase === "night" && [[22,30],[30,50],[18,60],[76,20],[80,56],[26,100],[82,100]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.8" fill={ink} />
        ))}
        <rect x="-4" y="168" width="104" height="6" fill={bg} stroke={ink} strokeWidth="2" />
      </svg>
    );
  },
});

// ── 6 · Wall clock — hands at current time ────────────────────────────
registerFurniture({
  id: "clock",
  name: "Wall Clock",
  category: "decor",
  anchor: "wall",
  size: { w: 56, h: 56 },
  price: 30,
  description: "Tells the time. That's all you need from it.",
  render: ({ dark, state }) => {
    const { ink, bg } = inks(dark);
    const t = state.time;
    const h = t.getHours() % 12;
    const m = t.getMinutes();
    const hAng = (h + m / 60) * 30 - 90;
    const mAng = m * 6 - 90;
    const rad = (a: number): number => (a * Math.PI) / 180;
    const cx = 28, cy = 28;
    return (
      <svg viewBox="0 0 56 56" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <circle cx={cx} cy={cy} r="22" fill={bg} stroke={ink} strokeWidth="2" />
        {[0, 90, 180, 270].map((a) => (
          <line key={a}
            x1={cx + Math.cos(rad(a - 90)) * 18} y1={cy + Math.sin(rad(a - 90)) * 18}
            x2={cx + Math.cos(rad(a - 90)) * 22} y2={cy + Math.sin(rad(a - 90)) * 22}
            stroke={ink} strokeWidth="1.5" />
        ))}
        <line x1={cx} y1={cy} x2={cx + Math.cos(rad(hAng)) * 12} y2={cy + Math.sin(rad(hAng)) * 12} stroke={ink} strokeWidth="2.5" />
        <line x1={cx} y1={cy} x2={cx + Math.cos(rad(mAng)) * 18} y2={cy + Math.sin(rad(mAng)) * 18} stroke={ink} strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="1.5" fill={ink} />
      </svg>
    );
  },
});

// ── 7 · Picture frame — author of today's quote ───────────────────────
registerFurniture({
  id: "picture",
  name: "Picture Frame",
  category: "decor",
  anchor: "wall",
  size: { w: 96, h: 80 },
  price: 20,
  description: "Holds today's passage. Refreshes at dawn.",
  render: ({ dark, state }) => {
    const { ink, bg } = inks(dark);
    const author = state.quote?.author ?? "—";
    return (
      <svg viewBox="0 0 96 80" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="48" y1="0" x2="48" y2="6" stroke={ink} strokeWidth="1.5" />
        <rect x="4" y="6" width="88" height="68" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="10" y="12" width="76" height="56" fill={bg} stroke={ink} strokeWidth="1" />
        <text x="48" y="32" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="14" fill={ink}>"…"</text>
        <line x1="20" y1="44" x2="76" y2="44" stroke={ink} strokeWidth="0.8" opacity="0.5" />
        <line x1="22" y1="50" x2="74" y2="50" stroke={ink} strokeWidth="0.8" opacity="0.5" />
        <line x1="20" y1="56" x2="76" y2="56" stroke={ink} strokeWidth="0.8" opacity="0.5" />
        <text x="48" y="66" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="5" letterSpacing="0.1em" fill={ink} opacity="0.7">— {author.toUpperCase()}</text>
      </svg>
    );
  },
});

// ── 8 · Floor lamp ────────────────────────────────────────────────────
registerFurniture({
  id: "floorlamp",
  name: "Floor Lamp",
  category: "lighting",
  anchor: "floor",
  size: { w: 56, h: 230 },
  price: 40,
  description: "Casts a warm circle. Reduces eye strain at dusk.",
  render: ({ dark, state }) => {
    const { ink } = inks(dark);
    const lit = state.dayPhase !== "day";
    return (
      <svg viewBox="0 0 56 230" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="26" y="48" width="4" height="170" fill={ink} />
        <rect x="14" y="6"  width="28" height="3" fill={ink} />
        <rect x="6"  y="46" width="44" height="3" fill={ink} />
        <line x1="14" y1="9" x2="6"  y2="46" stroke={ink} strokeWidth="2" />
        <line x1="42" y1="9" x2="50" y2="46" stroke={ink} strokeWidth="2" />
        {lit && <circle cx="28" cy="44" r="2" fill={ink} />}
        <ellipse cx="28" cy="222" rx="14" ry="4" fill={ink} />
      </svg>
    );
  },
});

// ── 9 · Potted plant — grows with tokens earned today ─────────────────
registerFurniture({
  id: "plant",
  name: "Potted Plant",
  category: "decor",
  anchor: "floor",
  size: { w: 76, h: 116 },
  price: 30,
  description: "A small fern. Larger when you've earned today.",
  render: ({ dark, state }) => {
    const { ink, bg } = inks(dark);
    const tier = Math.min(3, Math.floor(state.tokensToday / 40));
    return (
      <svg viewBox="0 0 76 116" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="38" cy="56" rx="6" ry={28 + tier * 4} fill={bg} stroke={ink} strokeWidth="1.8" />
        <ellipse cx="24" cy="62" rx="6" ry={22 + tier * 3} fill={bg} stroke={ink} strokeWidth="1.8" transform="rotate(-22 24 62)" />
        <ellipse cx="52" cy="62" rx="6" ry={22 + tier * 3} fill={bg} stroke={ink} strokeWidth="1.8" transform="rotate(22 52 62)" />
        {tier >= 2 && (
          <>
            <ellipse cx="16" cy="70" rx="5" ry="16" fill={bg} stroke={ink} strokeWidth="1.5" transform="rotate(-44 16 70)" />
            <ellipse cx="60" cy="70" rx="5" ry="16" fill={bg} stroke={ink} strokeWidth="1.5" transform="rotate(44 60 70)" />
          </>
        )}
        <line x1="20" y1="84"  x2="56" y2="84"  stroke={ink} strokeWidth="2" />
        <line x1="20" y1="84"  x2="24" y2="110" stroke={ink} strokeWidth="2" />
        <line x1="56" y1="84"  x2="52" y2="110" stroke={ink} strokeWidth="2" />
        <line x1="24" y1="110" x2="52" y2="110" stroke={ink} strokeWidth="2" />
        <line x1="20" y1="88"  x2="56" y2="88"  stroke={ink} strokeWidth="1" />
      </svg>
    );
  },
});

// ── 10 · Rug ──────────────────────────────────────────────────────────
registerFurniture({
  id: "rug",
  name: "Rug",
  category: "rug",
  anchor: "floor",
  size: { w: 240, h: 24 },
  price: 25,
  description: "Defines the room. Warm underfoot.",
  render: ({ dark }) => {
    const { ink, bg } = inks(dark);
    return (
      <svg viewBox="0 0 240 24" width="100%" height="100%" preserveAspectRatio="none">
        <ellipse cx="120" cy="14" rx="118" ry="8" fill={bg} stroke={ink} strokeWidth="2" />
        <line x1="20" y1="14" x2="220" y2="14" stroke={ink} strokeWidth="0.8" opacity="0.4" />
        <line x1="36" y1="10" x2="204" y2="10" stroke={ink} strokeWidth="0.8" opacity="0.3" />
        <line x1="36" y1="18" x2="204" y2="18" stroke={ink} strokeWidth="0.8" opacity="0.3" />
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={i} x1={6 + i * 2} y1="22" x2={6 + i * 2} y2="24" stroke={ink} strokeWidth="0.8" />
        ))}
      </svg>
    );
  },
});

// ── 11 · Stack of books ───────────────────────────────────────────────
registerFurniture({
  id: "stack",
  name: "Stack of Books",
  category: "decor",
  anchor: "floor",
  size: { w: 64, h: 50 },
  price: 15,
  description: "Yesterday's reading. Set down where it fell.",
  render: ({ dark }) => {
    const { ink, bg } = inks(dark);
    return (
      <svg viewBox="0 0 64 50" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="6"  y="34" width="52" height="12" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="10" y="22" width="44" height="12" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="2"  y="10" width="52" height="12" fill={bg} stroke={ink} strokeWidth="2" />
        <line x1="14" y1="14" x2="42" y2="14" stroke={ink} strokeWidth="1" opacity="0.5" />
        <line x1="20" y1="26" x2="44" y2="26" stroke={ink} strokeWidth="1" opacity="0.5" />
      </svg>
    );
  },
});

// ── 12 · Pet bed ──────────────────────────────────────────────────────
registerFurniture({
  id: "petbed",
  name: "Pet Bed",
  category: "decor",
  anchor: "floor",
  size: { w: 110, h: 32 },
  price: 40,
  description: "Where your companion sleeps when you're not at the desk.",
  render: ({ dark }) => {
    const { ink, bg } = inks(dark);
    return (
      <svg viewBox="0 0 110 32" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="55" cy="22" rx="52" ry="8" fill={bg} stroke={ink} strokeWidth="2" />
        <ellipse cx="55" cy="18" rx="44" ry="5" fill={bg} stroke={ink} strokeWidth="1" />
        <line x1="22" y1="18" x2="88" y2="18" stroke={ink} strokeWidth="0.8" opacity="0.4" />
      </svg>
    );
  },
});

// ── 13 · Globe ────────────────────────────────────────────────────────
registerFurniture({
  id: "globe",
  name: "Globe",
  category: "decor",
  anchor: "floor",
  size: { w: 60, h: 96 },
  price: 50,
  description: "Continents implied by lines, not drawn.",
  render: ({ dark }) => {
    const { ink, bg } = inks(dark);
    return (
      <svg viewBox="0 0 60 96" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <circle cx="30" cy="32" r="22" fill={bg} stroke={ink} strokeWidth="2" />
        <ellipse cx="30" cy="32" rx="22" ry="6"  fill="none" stroke={ink} strokeWidth="0.8" />
        <ellipse cx="30" cy="32" rx="22" ry="14" fill="none" stroke={ink} strokeWidth="0.8" />
        <line x1="14" y1="14" x2="46" y2="50" stroke={ink} strokeWidth="1.5" />
        <line x1="30" y1="54" x2="30" y2="86" stroke={ink} strokeWidth="2" />
        <ellipse cx="30" cy="90" rx="16" ry="4" fill={bg} stroke={ink} strokeWidth="2" />
      </svg>
    );
  },
});

// ── 14 · Calendar — today's date ──────────────────────────────────────
registerFurniture({
  id: "calendar",
  name: "Calendar",
  category: "decor",
  anchor: "wall",
  size: { w: 64, h: 76 },
  price: 20,
  description: "Today, in large numerals.",
  render: ({ dark, state }) => {
    const { ink, bg } = inks(dark);
    const day = state.time.getDate();
    const month = state.time.toLocaleString("en", { month: "short" }).toUpperCase();
    return (
      <svg viewBox="0 0 64 76" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="22" y1="0" x2="22" y2="8" stroke={ink} strokeWidth="1.5" />
        <line x1="42" y1="0" x2="42" y2="8" stroke={ink} strokeWidth="1.5" />
        <rect x="4" y="4" width="56" height="68" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="4" y="4" width="56" height="16" fill={ink} />
        <text x="32" y="16" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9" fill={bg} letterSpacing="0.15em">{month}</text>
        <text x="32" y="52" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="32" fill={ink} letterSpacing="-0.04em">{day}</text>
      </svg>
    );
  },
});

// ── 15 · Tea cart ─────────────────────────────────────────────────────
registerFurniture({
  id: "teacart",
  name: "Tea Cart",
  category: "surface",
  anchor: "floor",
  size: { w: 96, h: 96 },
  price: 80,
  description: "Holds a kettle and a single cup.",
  render: ({ dark }) => {
    const { ink, bg } = inks(dark);
    return (
      <svg viewBox="0 0 96 96" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x="6" y="46" width="84" height="6" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="6" y="60" width="84" height="6" fill={bg} stroke={ink} strokeWidth="1.5" />
        <line x1="12" y1="52" x2="12" y2="84" stroke={ink} strokeWidth="2" />
        <line x1="84" y1="52" x2="84" y2="84" stroke={ink} strokeWidth="2" />
        <circle cx="14" cy="86" r="6" fill={bg} stroke={ink} strokeWidth="2" />
        <circle cx="82" cy="86" r="6" fill={bg} stroke={ink} strokeWidth="2" />
        <ellipse cx="38" cy="38" rx="14" ry="10" fill={bg} stroke={ink} strokeWidth="2" />
        <line x1="50" y1="34" x2="58" y2="28" stroke={ink} strokeWidth="2" />
        <ellipse cx="38" cy="28" rx="6" ry="3" fill={bg} stroke={ink} strokeWidth="1.5" />
        <rect x="64" y="36" width="14" height="10" fill={bg} stroke={ink} strokeWidth="1.5" />
        <ellipse cx="71" cy="36" rx="7" ry="2" fill={bg} stroke={ink} strokeWidth="1.5" />
        <ellipse cx="80" cy="41" rx="3" ry="3" fill="none" stroke={ink} strokeWidth="1.2" />
      </svg>
    );
  },
});

// ── 16 · Wall sconce ─────────────────────────────────────────────────
registerFurniture({
  id: "sconce",
  name: "Wall Sconce",
  category: "lighting",
  anchor: "wall",
  size: { w: 32, h: 48 },
  price: 15,
  description: "A small light on the wall, for the evening hours.",
  render: ({ dark, state }) => {
    const { ink, bg } = inks(dark);
    const lit = state.dayPhase !== "day";
    return (
      <svg viewBox="0 0 32 48" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="16" y1="0" x2="16" y2="12" stroke={ink} strokeWidth="2" />
        <ellipse cx="16" cy="20" rx="12" ry="8" fill={bg} stroke={ink} strokeWidth="2" />
        {lit && <circle cx="16" cy="20" r="4" fill={ink} />}
        <rect x="14" y="28" width="4" height="16" fill={ink} />
      </svg>
    );
  },
});
