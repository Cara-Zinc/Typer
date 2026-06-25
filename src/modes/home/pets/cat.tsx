// cat.tsx — Borges. Elongated, slit-eyed, contemplative.

import { registerPet } from "./registry";
import { petPalette, pupil, rewardTone, SleepMark } from "./helpers";

registerPet({
  id: "cat",
  name: "Borges",
  species: "Cat",
  credo: "Will defeat you at chess and at metaphor.",
  mbtiTypes: ["INTP", "ISTP"],
  aspect: 1.0,
  render: (state) => {
    const { mood, blink, gaze, hunger, dark, accent, tone = "mono" } = state;
    const { ink, bg, paper, wash, shadow } = petPalette({ dark, accent, tone });
    const cc = rewardTone(state);
    const p = pupil(gaze, 3, 2);
    const sleeping = mood === "sleep";
    return (
      <svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="cat-fur" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <line x1="0" y1="0" x2="0" y2="10" stroke={ink} strokeWidth="1" opacity="0.14" />
          </pattern>
        </defs>
        <ellipse cx="100" cy="174" rx="70" ry="6" fill={shadow} opacity="0.7" />
        <path d="M150 139c26-31 25-70 12-76-8 31-16 50-39 70" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M41 139c22-35 91-42 122-7 14 16-7 40-56 40-53 0-76-16-66-33Z" fill={paper} stroke={ink} strokeWidth="2.2" />
        <path d="M45 139c22-20 78-26 114-6" fill="url(#cat-fur)" opacity="0.9" />
        <path d="M58 166v18M81 168v17M124 168v17M148 164v18" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M49 64 43 30l24 20 32-2 24-20-6 35c13 19 8 55-30 65-45 11-75-15-72-48 1-13 6-24 20-32Z" fill={bg} stroke={ink} strokeWidth="2.2" />
        <path d="M49 64 43 30l24 20M99 48l24-20-6 35" fill={wash} stroke={ink} strokeWidth="1.4" opacity="0.55" />
        <g transform={`translate(${p.x * 0.6},${p.y * 0.6})`}>
          {blink || sleeping || mood === "happy" ? (
            <>
              <line x1="62" y1="82" x2="74" y2="82" stroke={ink} strokeWidth="2.2" />
              <line x1="86" y1="82" x2="98" y2="82" stroke={ink} strokeWidth="2.2" />
            </>
          ) : (
            <>
              <ellipse cx="68" cy="82" rx="3.5" ry="6" fill={ink} />
              <ellipse cx="92" cy="82" rx="3.5" ry="6" fill={ink} />
            </>
          )}
        </g>
        <path d="M37 97c12 0 22 2 32 6M35 106c14-2 25-2 33 0M94 103c10-4 22-6 34-6M94 106c10-1 21 0 32 2" stroke={ink} strokeWidth="1.2" fill="none" opacity="0.75" />
        <ellipse cx="80" cy="96" rx="2.5" ry="2" fill={ink} />
        {mood === "hungry"  && <ellipse cx="80" cy="106" rx="4" ry="3" fill={ink} />}
        {mood === "happy"   && <line x1="74" y1="104" x2="86" y2="104" stroke={ink} strokeWidth="2" />}
        {mood === "neutral" && <line x1="76" y1="104" x2="84" y2="104" stroke={ink} strokeWidth="1.5" />}
        {mood === "curious" && <circle cx="80" cy="104" r="2" fill={ink} />}
        {mood === "happy" && hunger > 50 && (
          <>
            <path d="M60 122c12 5 28 5 40 0" stroke={cc} strokeWidth="2.2" fill="none" />
            <circle cx="80" cy="127" r="4" fill={cc} stroke={ink} strokeWidth="0.8" />
          </>
        )}
        {sleeping && <SleepMark x={130} y={44} ink={ink} />}
      </svg>
    );
  },
});
