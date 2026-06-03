// tortoise.tsx — Trollope. Patient.

import { registerPet } from "./registry";
import { inks, pupil, shouldShowAccent, SleepMark } from "./helpers";

registerPet({
  id: "tortoise",
  name: "Trollope",
  species: "Tortoise",
  credo: "Three thousand words before breakfast, daily.",
  mbtiTypes: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"],
  aspect: 0.75,
  render: ({ mood, blink, gaze, hunger, dark, accent }) => {
    const { ink, bg } = inks(dark);
    const cc = shouldShowAccent({ mood, hunger, accent }) ? (accent as string) : ink;
    const p = pupil(gaze, 2, 1);
    const sleeping = mood === "sleep";
    const eyeRy = blink || sleeping ? 0.4 : 2.5;
    const shellColor = mood === "happy" && hunger > 50 ? cc : ink;
    return (
      <svg viewBox="0 0 240 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* Shell */}
        <ellipse cx="130" cy="92" rx="86" ry="48" fill={bg} stroke={ink} strokeWidth="2" />
        {/* Shell pattern */}
        {[
          [90, 88], [130, 80], [170, 88], [110, 110], [150, 110],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="11" fill="none" stroke={shellColor} strokeWidth="1.5" />
        ))}
        {/* Belly line */}
        <line x1="50" y1="120" x2="210" y2="120" stroke={ink} strokeWidth="2" />
        {/* Head */}
        <ellipse cx="32" cy="118" rx="22" ry="16" fill={bg} stroke={ink} strokeWidth="2" />
        {/* Eyes */}
        <g transform={`translate(${p.x},${p.y})`}>
          <ellipse cx="22" cy="114" rx="2.5" ry={eyeRy} fill={ink} />
          <ellipse cx="32" cy="114" rx="2.5" ry={eyeRy} fill={ink} />
        </g>
        {/* Mouth */}
        {mood === "hungry"  && <ellipse cx="20" cy="124" rx="3" ry="2" fill={ink} />}
        {mood === "happy"   && <line x1="16" y1="126" x2="28" y2="124" stroke={ink} strokeWidth="1.5" />}
        {mood === "neutral" && <line x1="18" y1="125" x2="26" y2="125" stroke={ink} strokeWidth="1.5" />}
        {/* Legs */}
        <rect x="74"  y="134" width="14" height="20" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="172" y="134" width="14" height="20" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="100" y="136" width="14" height="18" fill={bg} stroke={ink} strokeWidth="2" />
        <rect x="146" y="136" width="14" height="18" fill={bg} stroke={ink} strokeWidth="2" />
        {/* Tail */}
        <line x1="216" y1="100" x2="226" y2="98" stroke={ink} strokeWidth="2" />
        {sleeping && <SleepMark x={200} y={40} ink={ink} />}
      </svg>
    );
  },
});
