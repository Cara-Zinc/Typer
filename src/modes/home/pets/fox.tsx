// fox.tsx — Bradbury. Pointed snout, big plume tail.

import { registerPet } from "./registry";
import { petPalette, pupil, rewardTone, SleepMark } from "./helpers";

registerPet({
  id: "fox",
  name: "Bradbury",
  species: "Fox",
  credo: "Has forty notebooks, all begun.",
  mbtiTypes: ["ENFP", "ESFP", "ENFJ"],
  aspect: 0.95,
  render: (state) => {
    const { mood, blink, gaze, hunger, dark, accent, tone = "mono" } = state;
    const { ink, bg, paper, wash, shadow } = petPalette({ dark, accent, tone });
    const cc = rewardTone(state);
    const p = pupil(gaze, 3, 2);
    const sleeping = mood === "sleep";
    const eyeRy = blink || sleeping ? 0.5 : 4;
    return (
      <svg viewBox="0 0 220 190" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="fox-fur" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
            <line x1="0" y1="0" x2="0" y2="10" stroke={ink} strokeWidth="1" opacity="0.13" />
          </pattern>
        </defs>
        <ellipse cx="113" cy="171" rx="82" ry="7" fill={shadow} opacity="0.75" />
        <path d="M156 132c40-20 53-66 39-93-31 12-48 40-50 83" fill={paper} stroke={ink} strokeWidth="2.2" />
        <path d="M184 53c-6 20-17 36-32 48" fill="none" stroke={ink} strokeWidth="1.2" opacity="0.45" />
        <path d="M63 129c24-36 90-38 117-4 15 19-8 45-63 45-59 0-88-20-54-41Z" fill={paper} stroke={ink} strokeWidth="2.2" />
        <path d="M66 130c31-20 82-20 113 0" fill="url(#fox-fur)" opacity="0.8" />
        <path d="M67 153v20M89 156v18M130 156v18M153 151v21" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M61 62 51 29l25 19 27-2 24-20-8 35c18 18 6 49-23 58-34 11-66-3-69-28-2-15 6-27 34-29Z" fill={bg} stroke={ink} strokeWidth="2.2" />
        <path d="M61 62 51 29l25 19M103 46l24-20-8 35" fill={wash} stroke={ink} strokeWidth="1.4" opacity="0.55" />
        <path d="M61 91 28 99l34 9c12 5 25 5 37-1 5-8 4-17-1-25-15-5-27-4-37 9Z" fill={bg} stroke={ink} strokeWidth="2" />
        <circle cx="28" cy="99" r="3.5" fill={ink} />
        <g transform={`translate(${p.x * 0.7},${p.y * 0.7})`}>
          <ellipse cx="70" cy="80" rx="3.5" ry={eyeRy} fill={ink} />
          <ellipse cx="91" cy="80" rx="3.5" ry={eyeRy} fill={ink} />
        </g>
        {mood === "hungry" && <ellipse cx="43" cy="102" rx="3" ry="2" fill={ink} />}
        {mood === "happy" && <path d="M36 104c6 3 13 2 18-2" fill="none" stroke={ink} strokeWidth="2" />}
        {mood === "neutral" && <line x1="38" y1="105" x2="48" y2="104" stroke={ink} strokeWidth="1.5" />}
        {mood === "curious" && <path d="M69 67c7-4 12-4 18 0" fill="none" stroke={ink} strokeWidth="1.4" />}
        {mood === "happy" && hunger > 50 && (
          <path d="M103 124c9 16 24 17 38 0" fill={cc} stroke={ink} strokeWidth="1.2" opacity="0.85" />
        )}
        {sleeping && <SleepMark x={181} y={36} ink={ink} />}
      </svg>
    );
  },
});
