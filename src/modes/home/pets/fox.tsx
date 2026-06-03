// fox.tsx — Bradbury. Pointed snout, big plume tail.

import { registerPet } from "./registry";
import { inks, pupil, shouldShowAccent, SleepMark } from "./helpers";

registerPet({
  id: "fox",
  name: "Bradbury",
  species: "Fox",
  credo: "Has forty notebooks, all begun.",
  mbtiTypes: ["ENFP", "ESFP", "ENFJ"],
  aspect: 0.95,
  render: ({ mood, blink, gaze, hunger, dark, accent }) => {
    const { ink, bg } = inks(dark);
    const cc = shouldShowAccent({ mood, hunger, accent }) ? (accent as string) : ink;
    const p = pupil(gaze, 3, 2);
    const sleeping = mood === "sleep";
    const eyeRy = blink || sleeping ? 0.5 : 4;
    return (
      <svg viewBox="0 0 220 190" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* Tail */}
        <ellipse cx="178" cy="100" rx="22" ry="38" fill={bg} stroke={ink} strokeWidth="2" />
        <ellipse cx="178" cy="68" rx="14" ry="14" fill={cc !== ink ? cc : bg} stroke={ink} strokeWidth="2" />
        {/* Body */}
        <ellipse cx="100" cy="130" rx="60" ry="28" fill={bg} stroke={ink} strokeWidth="2" />
        {/* Legs */}
        <rect x="62"  y="150" width="6" height="18" fill={ink} />
        <rect x="80"  y="150" width="6" height="18" fill={ink} />
        <rect x="118" y="150" width="6" height="18" fill={ink} />
        <rect x="136" y="150" width="6" height="18" fill={ink} />
        {/* Head + snout */}
        <ellipse cx="74" cy="84" rx="30" ry="28" fill={bg} stroke={ink} strokeWidth="2" />
        <line x1="62" y1="92"  x2="32" y2="98" stroke={ink} strokeWidth="2" />
        <line x1="62" y1="100" x2="32" y2="98" stroke={ink} strokeWidth="2" />
        <circle cx="32" cy="98" r="3" fill={ink} />
        {/* Ears */}
        <line x1="56" y1="60" x2="46" y2="32" stroke={ink} strokeWidth="2" />
        <line x1="56" y1="60" x2="68" y2="48" stroke={ink} strokeWidth="2" />
        <line x1="92" y1="60" x2="102" y2="32" stroke={ink} strokeWidth="2" />
        <line x1="92" y1="60" x2="80" y2="48" stroke={ink} strokeWidth="2" />
        {/* Eyes */}
        <g transform={`translate(${p.x * 0.7},${p.y * 0.7})`}>
          <ellipse cx="68" cy="82" rx="3.5" ry={eyeRy} fill={ink} />
          <ellipse cx="86" cy="82" rx="3.5" ry={eyeRy} fill={ink} />
        </g>
        {/* Mouth */}
        {mood === "hungry" && <ellipse cx="42" cy="100" rx="3" ry="2" fill={ink} />}
        {mood === "happy"  && <line x1="36" y1="102" x2="48" y2="100" stroke={ink} strokeWidth="2" />}
        {/* Chest mark (color reward) */}
        {mood === "happy" && hunger > 50 && (
          <ellipse cx="100" cy="130" rx="18" ry="10" fill={cc} opacity="0.85" />
        )}
        {sleeping && <SleepMark x={180} y={36} ink={ink} />}
      </svg>
    );
  },
});
