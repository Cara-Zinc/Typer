// inkling.tsx — Rilke, the default sensitive blob.
// Designer reference: a complete PetKind in ~80 lines. Copy this file to
// add your own pet; change the id/name/render; `import "./yourPet";` in
// pets/index.ts.

import { registerPet } from "./registry";
import { petPalette, pupil, rewardTone, SleepMark } from "./helpers";

registerPet({
  id: "inkling",
  name: "Rilke",
  species: "Inkling",
  credo: "Believes a single image can hold a season.",
  mbtiTypes: ["INFP", "INFJ", "ISFP"],
  aspect: 1.1,
  render: (state) => {
    const { mood, blink, gaze, hunger, dark, accent, tone = "mono" } = state;
    const p0 = petPalette({ dark, accent, tone });
    const { ink, bg, paper, wash, shadow } = p0;
    const cc = rewardTone(state);
    const p = pupil(gaze);
    const eyeRy = blink || mood === "sleep" ? 0.6 : 4.5;
    return (
      <svg viewBox="0 0 160 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="inkling-speckle" width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="3" r="0.8" fill={ink} opacity="0.22" />
            <circle cx="7" cy="7" r="0.7" fill={ink} opacity="0.18" />
          </pattern>
        </defs>
        <ellipse cx="80" cy="153" rx="36" ry="7" fill={shadow} opacity="0.7" />
        <path d="M43 54c-5-16-1-29 9-42 4 15 9 28 18 36h20c9-8 14-21 18-36 10 13 14 26 9 42 15 12 23 31 21 52-3 34-28 54-58 54s-55-20-58-54c-2-21 6-40 21-52Z" fill={paper} stroke={ink} strokeWidth="2.2" />
        <path d="M43 54c10 7 21 11 37 11s27-4 37-11" fill="none" stroke={ink} strokeWidth="1" opacity="0.35" />
        <path d="M39 76c12-7 29-11 41-11s29 4 41 11c-3 25-17 41-41 41S42 101 39 76Z" fill="url(#inkling-speckle)" opacity="0.9" />
        <path d="M51 139c14 10 43 10 58 0" fill="none" stroke={ink} strokeWidth="1.4" opacity="0.45" />
        {mood === "happy" && hunger > 50 && (
          <>
            <circle cx="49" cy="109" r="4" fill={cc} opacity="0.85" />
            <circle cx="111" cy="109" r="4" fill={cc} opacity="0.85" />
            <path d="M61 132c13 8 25 8 38 0" fill="none" stroke={cc} strokeWidth="1.5" opacity="0.65" />
          </>
        )}
        <g transform={`translate(${p.x},${p.y})`}>
          <ellipse cx="62" cy="92" rx="5.5" ry={eyeRy} fill={ink} />
          <ellipse cx="98" cy="92" rx="5.5" ry={eyeRy} fill={ink} />
          {!blink && mood !== "sleep" && (
            <>
              <circle cx="64" cy="90" r="1.2" fill={bg} />
              <circle cx="100" cy="90" r="1.2" fill={bg} />
            </>
          )}
        </g>
        {mood === "happy"   && <line x1="72" y1="114" x2="88" y2="114" stroke={ink} strokeWidth="2" />}
        {mood === "hungry"  && <ellipse cx="80" cy="116" rx="5" ry="3.5" fill={ink} />}
        {mood === "neutral" && <line x1="76" y1="116" x2="84" y2="116" stroke={ink} strokeWidth="2" />}
        {mood === "curious" && <circle cx="80" cy="116" r="2.5" fill={ink} />}
        {mood === "sleep"   && <line x1="76" y1="118" x2="84" y2="118" stroke={ink} strokeWidth="2" />}
        <path d="M51 151c6-6 14-6 20 0M89 151c6-6 14-6 20 0" fill="none" stroke={ink} strokeWidth="2.2" />
        {mood === "hungry" && <path d="M42 125c-5 5-6 12-1 18" fill="none" stroke={wash} strokeWidth="2" />}
        {mood === "sleep" && <SleepMark x={126} y={42} ink={ink} />}
      </svg>
    );
  },
});
