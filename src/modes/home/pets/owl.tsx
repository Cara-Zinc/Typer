// owl.tsx — Hesse. Tiny body, comically huge eyes.

import { registerPet } from "./registry";
import { inks, pupil, shouldShowAccent, SleepMark } from "./helpers";

registerPet({
  id: "owl",
  name: "Hesse",
  species: "Owl",
  credo: "Plans the chapter before you do.",
  mbtiTypes: ["INTJ", "ENTJ", "ENTP"],
  aspect: 1.15,
  render: ({ mood, blink, gaze, hunger, dark, accent }) => {
    const { ink, bg } = inks(dark);
    const cc = shouldShowAccent({ mood, hunger, accent }) ? (accent as string) : ink;
    const p = pupil(gaze, 4, 3);
    const sleeping = mood === "sleep";
    return (
      <svg viewBox="0 0 160 185" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* Ear tufts */}
        <line x1="42" y1="34" x2="36" y2="14" stroke={ink} strokeWidth="2.5" />
        <line x1="118" y1="34" x2="124" y2="14" stroke={ink} strokeWidth="2.5" />
        {/* Body */}
        <ellipse cx="80" cy="100" rx="50" ry="58" fill={bg} stroke={ink} strokeWidth="2" />
        {/* Facial-disc divider */}
        <line x1="80" y1="56" x2="80" y2="118" stroke={ink} strokeWidth="1" opacity="0.35" />
        {/* Eye discs */}
        <circle cx="56" cy="78" r="18" fill={bg} stroke={ink} strokeWidth="2" />
        <circle cx="104" cy="78" r="18" fill={bg} stroke={ink} strokeWidth="2" />
        {/* Pupils */}
        {blink || sleeping ? (
          <>
            <line x1="44" y1="78" x2="68" y2="78" stroke={ink} strokeWidth="2.5" />
            <line x1="92" y1="78" x2="116" y2="78" stroke={ink} strokeWidth="2.5" />
          </>
        ) : (
          <g transform={`translate(${p.x},${p.y})`}>
            <circle cx="56" cy="78" r="6" fill={ink} />
            <circle cx="104" cy="78" r="6" fill={ink} />
            <circle cx="59" cy="75" r="1.5" fill={bg} />
            <circle cx="107" cy="75" r="1.5" fill={bg} />
          </g>
        )}
        {/* Beak — diamond (rotated square, allowed) */}
        <rect x="76" y="100" width="8" height="8" fill={ink} transform="rotate(45 80 104)" />
        {/* Belly markings — color reward */}
        {mood === "happy" && hunger > 50 && (
          <>
            <circle cx="68" cy="134" r="2.5" fill={cc} />
            <circle cx="80" cy="142" r="2.5" fill={cc} />
            <circle cx="92" cy="134" r="2.5" fill={cc} />
          </>
        )}
        {/* Feet */}
        <line x1="60" y1="158" x2="60" y2="170" stroke={ink} strokeWidth="2" />
        <line x1="60" y1="170" x2="54" y2="174" stroke={ink} strokeWidth="2" />
        <line x1="60" y1="170" x2="66" y2="174" stroke={ink} strokeWidth="2" />
        <line x1="100" y1="158" x2="100" y2="170" stroke={ink} strokeWidth="2" />
        <line x1="100" y1="170" x2="94" y2="174" stroke={ink} strokeWidth="2" />
        <line x1="100" y1="170" x2="106" y2="174" stroke={ink} strokeWidth="2" />
        {mood === "hungry" && <circle cx="80" cy="116" r="3" fill={bg} stroke={ink} strokeWidth="1.5" />}
        {sleeping && <SleepMark x={130} y={28} ink={ink} />}
      </svg>
    );
  },
});
