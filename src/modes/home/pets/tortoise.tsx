// tortoise.tsx — Trollope. Patient.

import { registerPet } from "./registry";
import { petPalette, pupil, rewardTone, SleepMark } from "./helpers";

registerPet({
  id: "tortoise",
  name: "Trollope",
  species: "Tortoise",
  credo: "Three thousand words before breakfast, daily.",
  mbtiTypes: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"],
  aspect: 0.75,
  render: (state) => {
    const { mood, blink, gaze, hunger, dark, accent, tone = "mono" } = state;
    const { ink, bg, paper, wash, shadow } = petPalette({ dark, accent, tone });
    const cc = rewardTone(state);
    const p = pupil(gaze, 2, 1);
    const sleeping = mood === "sleep";
    const eyeRy = blink || sleeping ? 0.4 : 2.5;
    const shellStroke = mood === "happy" && hunger > 50 ? cc : ink;
    return (
      <svg viewBox="0 0 240 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="tortoise-shell" width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M0 9h18M9 0v18" stroke={shellStroke} strokeWidth="0.7" opacity="0.18" />
          </pattern>
        </defs>
        <ellipse cx="128" cy="155" rx="94" ry="8" fill={shadow} opacity="0.75" />
        <path d="M43 116c20-55 142-69 180 5-19 30-148 36-180-5Z" fill={paper} stroke={ink} strokeWidth="2.2" />
        <path d="M62 118c22-42 112-52 142 1-31 18-107 19-142-1Z" fill="url(#tortoise-shell)" stroke={shellStroke} strokeWidth="1.4" />
        <path d="M91 104c8-18 26-26 39-29 15 3 34 11 43 30M130 77v58M84 123c25 9 65 11 94 0" fill="none" stroke={shellStroke} strokeWidth="1.4" opacity="0.9" />
        <path d="M44 117c-18-13-35-8-39 7-4 17 14 27 36 17" fill={bg} stroke={ink} strokeWidth="2" />
        <g transform={`translate(${p.x},${p.y})`}>
          <ellipse cx="23" cy="121" rx="2.5" ry={eyeRy} fill={ink} />
          <ellipse cx="35" cy="121" rx="2.5" ry={eyeRy} fill={ink} />
        </g>
        {mood === "hungry" && <ellipse cx="20" cy="132" rx="3" ry="2" fill={ink} />}
        {mood === "happy" && <path d="M16 134c6 3 13 2 18-2" fill="none" stroke={ink} strokeWidth="1.6" />}
        {mood === "neutral" && <line x1="18" y1="132" x2="28" y2="132" stroke={ink} strokeWidth="1.5" />}
        {mood === "curious" && <path d="M15 113c7-5 17-5 25 0" fill="none" stroke={ink} strokeWidth="1.2" />}
        <path d="M69 137h19v21H69zM172 137h19v21h-19zM101 140h18v18h-18zM140 140h18v18h-18z" fill={wash} stroke={ink} strokeWidth="2" />
        <path d="M222 111c9-1 14 2 16 8" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        {sleeping && <SleepMark x={200} y={40} ink={ink} />}
      </svg>
    );
  },
});
