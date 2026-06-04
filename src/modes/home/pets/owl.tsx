// owl.tsx — Hesse. Tiny body, comically huge eyes.

import { registerPet } from "./registry";
import { petPalette, pupil, rewardTone, SleepMark } from "./helpers";

registerPet({
  id: "owl",
  name: "Hesse",
  species: "Owl",
  credo: "Plans the chapter before you do.",
  mbtiTypes: ["INTJ", "ENTJ", "ENTP"],
  aspect: 1.15,
  render: (state) => {
    const { mood, blink, gaze, hunger, dark, accent, tone = "mono" } = state;
    const { ink, bg, paper, wash, shadow } = petPalette({ dark, accent, tone });
    const cc = rewardTone(state);
    const p = pupil(gaze, 4, 3);
    const sleeping = mood === "sleep";
    return (
      <svg viewBox="0 0 160 185" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="owl-feather" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 8c4-4 8-4 12 0" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.18" />
          </pattern>
        </defs>
        <ellipse cx="80" cy="171" rx="42" ry="6" fill={shadow} opacity="0.75" />
        <path d="M43 36 33 10l26 19c13-7 29-7 42 0l26-19-10 26c18 21 20 65 2 96-18 30-60 39-88 15-31-26-31-85 12-111Z" fill={paper} stroke={ink} strokeWidth="2.2" />
        <path d="M39 104c22 22 60 22 82 0 0 34-17 54-41 54s-41-20-41-54Z" fill="url(#owl-feather)" opacity="0.9" />
        <path d="M80 54v66" stroke={ink} strokeWidth="1" opacity="0.28" />
        <circle cx="56" cy="78" r="22" fill={bg} stroke={ink} strokeWidth="2" />
        <circle cx="104" cy="78" r="22" fill={bg} stroke={ink} strokeWidth="2" />
        <circle cx="56" cy="78" r="15" fill={wash} stroke={ink} strokeWidth="0.8" opacity="0.45" />
        <circle cx="104" cy="78" r="15" fill={wash} stroke={ink} strokeWidth="0.8" opacity="0.45" />
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
        <path d="M73 101h14l-7 10Z" fill={ink} />
        {mood === "hungry" && <circle cx="80" cy="120" r="3" fill={bg} stroke={ink} strokeWidth="1.5" />}
        {mood === "curious" && <path d="M47 50c8-5 15-5 22 0M91 49c9-5 17-5 24 0" fill="none" stroke={ink} strokeWidth="1.3" />}
        {mood === "happy" && hunger > 50 && (
          <>
            <path d="M63 133c6 7 11 7 17 0 6 7 11 7 17 0" fill="none" stroke={cc} strokeWidth="2" />
            <circle cx="80" cy="145" r="3" fill={cc} />
          </>
        )}
        <path d="M58 158v12m0 0-7 4m7-4 7 4M102 158v12m0 0-7 4m7-4 7 4" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        {sleeping && <SleepMark x={130} y={28} ink={ink} />}
      </svg>
    );
  },
});
