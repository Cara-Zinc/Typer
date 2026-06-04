// items.tsx — Furniture catalog.
//
// The default Study pieces use a richer "literary grayscale diorama" SVG
// style: layered silhouettes, hatching, cast shadows, and a color-capable
// palette that currently renders in mono by default.

import { registerFurniture } from "./registry";
import { illustrationPalette, type IllustrationPalette } from "../illustration";

function palette(dark: boolean, tone: "mono" | "color" = "mono", accent: string | null = null): IllustrationPalette {
  return illustrationPalette(dark, tone, accent);
}

function Hatch({
  id,
  ink,
  opacity = 0.28,
}: {
  id: string;
  ink: string;
  opacity?: number;
}) {
  return (
    <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke={ink} strokeWidth="1" opacity={opacity} />
    </pattern>
  );
}

// 1. Bookshelf - fills with pages read
registerFurniture({
  id: "bookshelf",
  name: "Bookshelf",
  category: "storage",
  anchor: "floor",
  size: { w: 120, h: 230 },
  price: 80,
  description: "Visible books scale with pages read this week.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const totalBooks = Math.min(30, Math.max(6, Math.floor(state.pagesRead / 4) + 7));
    const shelves = 4;
    const perShelf = Math.ceil(totalBooks / shelves);
    return (
      <svg viewBox="0 0 120 230" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs><Hatch id="shelf-hatch" ink={p.ink} /></defs>
        <ellipse cx="60" cy="226" rx="58" ry="6" fill={p.shadow} opacity="0.55" />
        <path d="M8 8h104l6 218H2L8 8Z" fill={p.bg} stroke={p.ink} strokeWidth="2.2" />
        <path d="M15 18h90v198H15z" fill={`url(#shelf-hatch)`} opacity="0.7" />
        {[58, 113, 168, 216].map((y) => (
          <path key={y} d={`M10 ${y}h100l4 6H6l4-6Z`} fill={p.paper} stroke={p.ink} strokeWidth="1.6" />
        ))}
        {Array.from({ length: shelves }).flatMap((_, shelfIdx) => {
          const top = 16 + shelfIdx * 55;
          const visible = Math.min(perShelf, Math.max(0, totalBooks - shelfIdx * perShelf));
          return Array.from({ length: visible }).map((_, b) => {
            const x = 14 + b * 8.5;
            const h = 40 + ((b + shelfIdx) % 4) * 3;
            const fill = tone === "color" && b % 7 === 0 ? p.accent : p.bg;
            return (
              <g key={`${shelfIdx}-${b}`}>
                <path d={`M${x} ${top + 42 - h}h6l1 ${h}h-7Z`} fill={fill} stroke={p.ink} strokeWidth="1" />
                {(b + shelfIdx) % 3 === 0 && <line x1={x + 3} y1={top + 46 - h} x2={x + 3} y2={top + 38} stroke={p.ink} strokeWidth="0.5" opacity="0.45" />}
              </g>
            );
          });
        })}
        <path d="M0 224h120v5H0z" fill={p.ink} />
      </svg>
    );
  },
});

// 2. Writing desk - typewriter + paper stack from words written
registerFurniture({
  id: "desk",
  name: "Writing Desk",
  category: "surface",
  anchor: "floor",
  size: { w: 180, h: 110 },
  price: 100,
  description: "A solid oak desk with a typewriter and a stack of pages.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const pages = Math.min(8, Math.floor(state.words / 250));
    return (
      <svg viewBox="0 0 180 110" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs><Hatch id="desk-hatch" ink={p.ink} opacity={0.18} /></defs>
        <ellipse cx="91" cy="107" rx="82" ry="5" fill={p.shadow} />
        <path d="M6 40h168l-7 12H13L6 40Z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <path d="M18 52h144v17H18z" fill={`url(#desk-hatch)`} stroke={p.ink} strokeWidth="1.8" />
        <path d="M17 69h13l-5 39H8l9-39Zm133 0h13l9 39h-17l-5-39Z" fill={p.ink} />
        <path d="M56 23h62l10 17H47l9-17Z" fill={p.bg} stroke={p.ink} strokeWidth="2" />
        <path d="M64 10h45l7 13H58l6-13Z" fill={p.paper} stroke={p.ink} strokeWidth="1.7" />
        <path d="M78 4h28v9H78z" fill={p.bg} stroke={p.ink} strokeWidth="1.4" />
        {[64, 75, 86, 97, 108].map((x, i) => (
          <circle key={i} cx={x} cy="34" r="2" fill={p.ink} />
        ))}
        {Array.from({ length: pages }).map((_, i) => (
          <path key={i} d={`M126 ${35 - i * 2}h26l2 4h-28Z`} fill={p.bg} stroke={p.ink} strokeWidth="0.8" opacity={0.96 - i * 0.05} />
        ))}
        <path d="M28 45h26M126 45h26" stroke={p.ink} strokeWidth="1" opacity="0.35" />
      </svg>
    );
  },
});

// 3. Reading chair
registerFurniture({
  id: "chair",
  name: "Reading Chair",
  category: "seating",
  anchor: "floor",
  size: { w: 100, h: 140 },
  price: 60,
  description: "A high-back armchair. The pet may claim it.",
  render: ({ dark, tone = "mono", accent }) => {
    const p = palette(dark, tone, accent);
    return (
      <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs><Hatch id="chair-hatch" ink={p.ink} opacity={0.2} /></defs>
        <ellipse cx="54" cy="132" rx="38" ry="5" fill={p.shadow} />
        <path d="M14 14c0-7 5-11 12-10h42c10 0 16 7 16 18v86H14V14Z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <path d="M22 21h54v44H22z" fill={`url(#chair-hatch)`} opacity="0.8" />
        <path d="M8 68h84l-7 36H18L8 68Z" fill={p.bg} stroke={p.ink} strokeWidth="2" />
        <path d="M16 82h68M20 94h60" stroke={p.ink} strokeWidth="1" opacity="0.35" />
        <path d="M20 103h10v28H20zm50 0h10v28H70z" fill={p.ink} />
        <path d="M2 62h18v48H2zm78 0h18v48H80z" fill={p.bg} stroke={p.ink} strokeWidth="2" />
      </svg>
    );
  },
});

// 4. Fireplace - flame tier from streak
registerFurniture({
  id: "fireplace",
  name: "Fireplace",
  category: "decor",
  anchor: "floor",
  size: { w: 150, h: 180 },
  price: 240,
  description: "Burns brighter with every day of your streak.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const streak = state.streak;
    const tier = streak <= 0 ? 0 : streak <= 2 ? 1 : streak <= 5 ? 2 : streak <= 13 ? 3 : 4;
    const flame = streak > 0 ? p.ember : p.ink;
    return (
      <svg viewBox="0 0 150 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs><Hatch id="fire-hatch" ink={p.ink} opacity={0.2} /></defs>
        <ellipse cx="75" cy="176" rx="70" ry="5" fill={p.shadow} />
        <path d="M1 27h148l-8 17H9L1 27Z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <path d="M10 44h130v119H10z" fill={`url(#fire-hatch)`} stroke={p.ink} strokeWidth="2" />
        <path d="M31 64h88v99H31V64Zm12 15v84h64V79Z" fill={p.bg} stroke={p.ink} strokeWidth="2" />
        <path d="M0 163h150v16H0z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        {tier >= 1 && <path d="M42 148h32l-5 6H38l4-6Zm35-8h34l-5 6H72l5-6Z" fill={p.ink} />}
        {tier >= 1 && <path d="M75 137c-13-13 2-24 0-38 17 18 23 35 0 38Z" fill={flame} stroke={p.ink} strokeWidth="1.2" />}
        {tier >= 2 && <path d="M57 137c-10-9 0-20 1-29 12 13 16 25-1 29Z" fill={flame} stroke={p.ink} strokeWidth="0.8" />}
        {tier >= 2 && <path d="M94 137c-9-8-2-18 0-26 11 11 14 23 0 26Z" fill={flame} stroke={p.ink} strokeWidth="0.8" />}
        {tier >= 3 && <path d="M75 126c-7-8 1-17 1-26 9 12 12 20-1 26Z" fill={p.bg} opacity="0.7" />}
        <circle cx="75" cy="19" r="6" fill={p.bg} stroke={p.ink} strokeWidth="1.5" />
      </svg>
    );
  },
});

// 5. Tall window - sky reflects time of day
registerFurniture({
  id: "window",
  name: "Tall Window",
  category: "window",
  anchor: "wall",
  size: { w: 96, h: 170 },
  price: 0,
  description: "Sky outside changes with the hour.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const phase = state.dayPhase;
    const orbY = phase === "night" ? 35 : phase === "day" ? 50 : 108;
    return (
      <svg viewBox="0 0 96 170" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs><Hatch id="window-hatch" ink={p.ink} opacity={phase === "night" ? 0.2 : 0.1} /></defs>
        <path d="M6 3h84v161H6z" fill={p.bg} stroke={p.ink} strokeWidth="2" />
        <path d="M13 12h70v143H13z" fill={phase === "night" ? p.wash : p.paper} stroke={p.ink} strokeWidth="1" />
        <path d="M13 12h70v143H13z" fill="url(#window-hatch)" />
        <path d="M48 12v143M13 84h70" stroke={p.ink} strokeWidth="2" />
        <circle cx="66" cy={orbY} r="10" fill={phase === "night" ? p.bg : p.warm} stroke={p.ink} strokeWidth="1.4" />
        {phase === "night" && <circle cx="62" cy={orbY - 3} r="6" fill={p.wash} />}
        {phase === "night" && [[24,32],[31,52],[21,67],[77,24],[74,62],[28,106],[78,104]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1" fill={p.ink} opacity="0.75" />
        ))}
        <path d="M0 164h96v6H0z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
      </svg>
    );
  },
});

// 6. Wall clock - hands at current time
registerFurniture({
  id: "clock",
  name: "Wall Clock",
  category: "decor",
  anchor: "wall",
  size: { w: 56, h: 56 },
  price: 30,
  description: "Tells the time. That's all you need from it.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const t = state.time;
    const h = t.getHours() % 12;
    const m = t.getMinutes();
    const hAng = (h + m / 60) * 30 - 90;
    const mAng = m * 6 - 90;
    const rad = (a: number): number => (a * Math.PI) / 180;
    const cx = 28, cy = 28;
    return (
      <svg viewBox="0 0 56 56" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <circle cx={cx} cy={cy + 1} r="24" fill={p.shadow} opacity="0.4" />
        <circle cx={cx} cy={cy} r="23" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <circle cx={cx} cy={cy} r="17" fill={p.bg} stroke={p.ink} strokeWidth="0.8" opacity="0.9" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = i * 30 - 90;
          return <line key={i} x1={cx + Math.cos(rad(a)) * 19} y1={cy + Math.sin(rad(a)) * 19} x2={cx + Math.cos(rad(a)) * 21} y2={cy + Math.sin(rad(a)) * 21} stroke={p.ink} strokeWidth={i % 3 === 0 ? 1.6 : 0.8} />;
        })}
        <line x1={cx} y1={cy} x2={cx + Math.cos(rad(hAng)) * 11} y2={cy + Math.sin(rad(hAng)) * 11} stroke={p.ink} strokeWidth="2.4" />
        <line x1={cx} y1={cy} x2={cx + Math.cos(rad(mAng)) * 17} y2={cy + Math.sin(rad(mAng)) * 17} stroke={p.ink} strokeWidth="1.3" />
        <circle cx={cx} cy={cy} r="2" fill={p.ink} />
      </svg>
    );
  },
});

// 7. Picture frame - author of today's quote
registerFurniture({
  id: "picture",
  name: "Picture Frame",
  category: "decor",
  anchor: "wall",
  size: { w: 96, h: 80 },
  price: 20,
  description: "Holds today's passage. Refreshes at dawn.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const author = state.quote?.author ?? "-";
    return (
      <svg viewBox="0 0 96 80" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="48" y1="0" x2="48" y2="7" stroke={p.ink} strokeWidth="1.5" />
        <path d="M5 7h86v66H5z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <path d="M11 13h74v54H11z" fill={p.bg} stroke={p.ink} strokeWidth="1" />
        <path d="M18 48c12-19 22-21 30-9 10-14 22-11 32 9" fill="none" stroke={p.ink} strokeWidth="1.1" opacity="0.5" />
        <text x="48" y="31" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="14" fill={p.ink}>"..."</text>
        <line x1="20" y1="43" x2="76" y2="43" stroke={p.ink} strokeWidth="0.8" opacity="0.5" />
        <line x1="23" y1="50" x2="73" y2="50" stroke={p.ink} strokeWidth="0.8" opacity="0.45" />
        <text x="48" y="65" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="5" letterSpacing="0.08em" fill={p.ink} opacity="0.7">- {author.toUpperCase()}</text>
      </svg>
    );
  },
});

// 8. Floor lamp
registerFurniture({
  id: "floorlamp",
  name: "Floor Lamp",
  category: "lighting",
  anchor: "floor",
  size: { w: 56, h: 230 },
  price: 40,
  description: "Casts a warm circle. Reduces eye strain at dusk.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const lit = state.dayPhase !== "day";
    return (
      <svg viewBox="0 0 56 230" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="28" cy="224" rx="17" ry="5" fill={p.shadow} />
        {lit && <path d="M8 47h40l-12 82H20L8 47Z" fill={p.wash} opacity="0.45" />}
        <rect x="26" y="48" width="4" height="170" fill={p.ink} />
        <path d="M14 7h28l9 40H5L14 7Z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <path d="M14 7h28M5 47h46" stroke={p.ink} strokeWidth="1.2" />
        {lit && <circle cx="28" cy="44" r="2.5" fill={p.warm} />}
        <ellipse cx="28" cy="222" rx="14" ry="4" fill={p.ink} />
      </svg>
    );
  },
});

// 9. Potted plant - grows with tokens earned today
registerFurniture({
  id: "plant",
  name: "Potted Plant",
  category: "decor",
  anchor: "floor",
  size: { w: 76, h: 116 },
  price: 30,
  description: "A small fern. Larger when you've earned today.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const tier = Math.min(3, Math.floor(state.tokensToday / 40));
    const leaf = tier > 0 ? p.leaf : p.ink;
    return (
      <svg viewBox="0 0 76 116" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="39" cy="112" rx="26" ry="4" fill={p.shadow} />
        <path d="M39 88C31 61 33 42 39 25c6 17 8 36 0 63Z" fill={p.bg} stroke={leaf} strokeWidth="1.8" />
        <path d="M34 84C18 62 13 47 18 35c13 10 22 26 23 49Z" fill={p.bg} stroke={leaf} strokeWidth="1.8" />
        <path d="M44 84c16-22 21-37 16-49-13 10-22 26-23 49Z" fill={p.bg} stroke={leaf} strokeWidth="1.8" />
        {tier >= 2 && (
          <>
            <path d="M29 82C12 72 8 59 8 48c12 4 21 14 27 34Z" fill={p.bg} stroke={leaf} strokeWidth="1.4" />
            <path d="M49 82c17-10 21-23 21-34-12 4-21 14-27 34Z" fill={p.bg} stroke={leaf} strokeWidth="1.4" />
          </>
        )}
        {tier >= 3 && <path d="M39 78C31 55 44 43 50 31c7 18 4 34-11 47Z" fill={p.bg} stroke={leaf} strokeWidth="1.3" />}
        <path d="M19 84h40l-7 27H26L19 84Z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <path d="M23 90h32" stroke={p.ink} strokeWidth="1" opacity="0.5" />
      </svg>
    );
  },
});

// 10. Rug
registerFurniture({
  id: "rug",
  name: "Rug",
  category: "rug",
  anchor: "floor",
  size: { w: 240, h: 24 },
  price: 25,
  description: "Defines the room. Warm underfoot.",
  render: ({ dark, tone = "mono", accent }) => {
    const p = palette(dark, tone, accent);
    return (
      <svg viewBox="0 0 240 24" width="100%" height="100%" preserveAspectRatio="none">
        <path d="M6 14c25-12 202-12 228 0-25 12-203 12-228 0Z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <path d="M33 14c21-5 152-5 174 0-22 5-153 5-174 0Z" fill={p.wash} stroke={p.ink} strokeWidth="0.9" opacity="0.75" />
        {[44, 74, 104, 134, 164, 194].map((x) => <line key={x} x1={x} y1="8" x2={x - 18} y2="20" stroke={p.ink} strokeWidth="0.7" opacity="0.4" />)}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1={6 + i * 2} y1="21" x2={6 + i * 2} y2="24" stroke={p.ink} strokeWidth="0.8" />
        ))}
      </svg>
    );
  },
});

// 11. Stack of books
registerFurniture({
  id: "stack",
  name: "Stack of Books",
  category: "decor",
  anchor: "floor",
  size: { w: 64, h: 50 },
  price: 15,
  description: "Yesterday's reading. Set down where it fell.",
  render: ({ dark, tone = "mono", accent }) => {
    const p = palette(dark, tone, accent);
    return (
      <svg viewBox="0 0 64 50" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="33" cy="47" rx="28" ry="3" fill={p.shadow} />
        <path d="M7 35h51l3 10H5l2-10Z" fill={p.paper} stroke={p.ink} strokeWidth="1.8" />
        <path d="M12 23h43l-2 12H9l3-12Z" fill={tone === "color" ? p.accent : p.bg} stroke={p.ink} strokeWidth="1.7" />
        <path d="M2 10h52l4 13H6L2 10Z" fill={p.paper} stroke={p.ink} strokeWidth="1.8" />
        <line x1="15" y1="15" x2="43" y2="15" stroke={p.ink} strokeWidth="0.8" opacity="0.5" />
        <line x1="19" y1="28" x2="45" y2="28" stroke={p.ink} strokeWidth="0.8" opacity="0.5" />
      </svg>
    );
  },
});

// 12. Pet bed
registerFurniture({
  id: "petbed",
  name: "Pet Bed",
  category: "decor",
  anchor: "floor",
  size: { w: 110, h: 32 },
  price: 40,
  description: "Where your companion sleeps when you're not at the desk.",
  render: ({ dark, tone = "mono", accent }) => {
    const p = palette(dark, tone, accent);
    return (
      <svg viewBox="0 0 110 32" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="55" cy="25" rx="52" ry="6" fill={p.shadow} />
        <path d="M7 21c6-13 21-18 48-18s42 5 48 18c-9 8-88 8-96 0Z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <path d="M22 19c12-7 54-7 66 0" fill="none" stroke={p.ink} strokeWidth="1" opacity="0.4" />
        <path d="M36 13h38" stroke={p.ink} strokeWidth="0.8" opacity="0.35" />
      </svg>
    );
  },
});

// 13. Globe
registerFurniture({
  id: "globe",
  name: "Globe",
  category: "decor",
  anchor: "floor",
  size: { w: 60, h: 96 },
  price: 50,
  description: "Continents implied by lines, not drawn.",
  render: ({ dark, tone = "mono", accent }) => {
    const p = palette(dark, tone, accent);
    return (
      <svg viewBox="0 0 60 96" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <circle cx="30" cy="32" r="22" fill={p.bg} stroke={p.ink} strokeWidth="2" />
        <ellipse cx="30" cy="32" rx="22" ry="6" fill="none" stroke={p.ink} strokeWidth="0.8" />
        <ellipse cx="30" cy="32" rx="22" ry="14" fill="none" stroke={p.ink} strokeWidth="0.8" />
        <path d="M14 14c12 9 20 18 32 36" fill="none" stroke={p.ink} strokeWidth="1.5" />
        <line x1="30" y1="54" x2="30" y2="86" stroke={p.ink} strokeWidth="2" />
        <ellipse cx="30" cy="90" rx="16" ry="4" fill={p.bg} stroke={p.ink} strokeWidth="2" />
      </svg>
    );
  },
});

// 14. Calendar - today's date
registerFurniture({
  id: "calendar",
  name: "Calendar",
  category: "decor",
  anchor: "wall",
  size: { w: 64, h: 76 },
  price: 20,
  description: "Today, in large numerals.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const day = state.time.getDate();
    const month = state.time.toLocaleString("en", { month: "short" }).toUpperCase();
    return (
      <svg viewBox="0 0 64 76" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line x1="21" y1="0" x2="21" y2="8" stroke={p.ink} strokeWidth="1.5" />
        <line x1="43" y1="0" x2="43" y2="8" stroke={p.ink} strokeWidth="1.5" />
        <path d="M5 5h54v66H5z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        <path d="M5 5h54v17H5z" fill={p.ink} />
        <text x="32" y="17" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9" fill={p.bg} letterSpacing="0.12em">{month}</text>
        <text x="32" y="53" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="32" fill={p.ink}>{day}</text>
        <path d="M14 59h36" stroke={p.ink} strokeWidth="1" opacity="0.25" />
      </svg>
    );
  },
});

// 15. Tea cart
registerFurniture({
  id: "teacart",
  name: "Tea Cart",
  category: "surface",
  anchor: "floor",
  size: { w: 96, h: 96 },
  price: 80,
  description: "Holds a kettle and a single cup.",
  render: ({ dark, tone = "mono", accent }) => {
    const p = palette(dark, tone, accent);
    return (
      <svg viewBox="0 0 96 96" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="48" cy="91" rx="40" ry="4" fill={p.shadow} />
        <path d="M8 46h80l-4 8H12l-4-8Zm6 17h68l-4 7H18l-4-7Z" fill={p.paper} stroke={p.ink} strokeWidth="1.8" />
        <path d="M13 54v30M83 54v30" stroke={p.ink} strokeWidth="2" />
        <circle cx="15" cy="86" r="6" fill={p.bg} stroke={p.ink} strokeWidth="2" />
        <circle cx="81" cy="86" r="6" fill={p.bg} stroke={p.ink} strokeWidth="2" />
        <path d="M25 38c2-10 22-12 28-2 3 5-1 11-14 11-10 0-16-3-14-9Z" fill={p.bg} stroke={p.ink} strokeWidth="2" />
        <path d="M49 35c6-3 8-6 11-8M33 29c4-4 12-4 17 0" stroke={p.ink} strokeWidth="1.6" fill="none" />
        <path d="M64 36h14v10H64z" fill={p.bg} stroke={p.ink} strokeWidth="1.5" />
        <ellipse cx="71" cy="36" rx="7" ry="2" fill={p.bg} stroke={p.ink} strokeWidth="1.5" />
        <path d="M78 40c8 0 8 8 0 8" fill="none" stroke={p.ink} strokeWidth="1.2" />
      </svg>
    );
  },
});

// 16. Wall sconce
registerFurniture({
  id: "sconce",
  name: "Wall Sconce",
  category: "lighting",
  anchor: "wall",
  size: { w: 32, h: 48 },
  price: 15,
  description: "A small light on the wall, for the evening hours.",
  render: ({ dark, tone = "mono", accent, state }) => {
    const p = palette(dark, tone, accent);
    const lit = state.dayPhase !== "day";
    return (
      <svg viewBox="0 0 32 48" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {lit && <path d="M4 19c4-8 20-8 24 0 0 9-4 18-12 24C8 37 4 28 4 19Z" fill={p.wash} opacity="0.5" />}
        <line x1="16" y1="0" x2="16" y2="12" stroke={p.ink} strokeWidth="2" />
        <path d="M5 18c2-9 20-9 22 0l-4 9H9l-4-9Z" fill={p.paper} stroke={p.ink} strokeWidth="2" />
        {lit && <circle cx="16" cy="21" r="4" fill={p.warm} stroke={p.ink} strokeWidth="0.8" />}
        <path d="M14 28h4v16h-4z" fill={p.ink} />
      </svg>
    );
  },
});
