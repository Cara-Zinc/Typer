// inkling.tsx — Rilke, the default sensitive blob.
// Designer reference: a complete PetKind in ~80 lines. Copy this file to
// add your own pet; change the id/name/render; `import "./yourPet";` in
// pets/index.ts.

import { registerPet } from "./registry";
import { inks, pupil, shouldShowAccent, SleepMark } from "./helpers";

registerPet({
  id: "inkling",
  name: "Rilke",
  species: "Inkling",
  credo: "Believes a single image can hold a season.",
  mbtiTypes: ["INFP", "INFJ", "ISFP"],
  aspect: 1.1,
  render: ({ mood, blink, gaze, hunger, dark, accent }) => {
    const { ink, bg } = inks(dark);
    const cc = shouldShowAccent({ mood, hunger, accent }) ? (accent as string) : ink;
    const p = pupil(gaze);
    const eyeRy = blink || mood === "sleep" ? 0.6 : 4.5;
    return (
      <svg viewBox="0 0 160 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* Ears — two V's */}
        <line x1="44" y1="52" x2="38" y2="28" stroke={ink} strokeWidth="2" />
        <line x1="44" y1="52" x2="52" y2="28" stroke={ink} strokeWidth="2" />
        <line x1="116" y1="52" x2="122" y2="28" stroke={ink} strokeWidth="2" />
        <line x1="116" y1="52" x2="108" y2="28" stroke={ink} strokeWidth="2" />
        {/* Body */}
        <ellipse cx="80" cy="98" rx="46" ry="50" fill={bg} stroke={ink} strokeWidth="2" />
        {/* Cheeks (color reward) */}
        {mood === "happy" && hunger > 50 && (
          <>
            <circle cx="46" cy="108" r="3" fill={cc} />
            <circle cx="114" cy="108" r="3" fill={cc} />
          </>
        )}
        {/* Eyes */}
        <g transform={`translate(${p.x},${p.y})`}>
          <ellipse cx="62" cy="92" rx="5.5" ry={eyeRy} fill={ink} />
          <ellipse cx="98" cy="92" rx="5.5" ry={eyeRy} fill={ink} />
        </g>
        {/* Mouth */}
        {mood === "happy"   && <line x1="72" y1="114" x2="88" y2="114" stroke={ink} strokeWidth="2" />}
        {mood === "hungry"  && <ellipse cx="80" cy="116" rx="5" ry="3.5" fill={ink} />}
        {mood === "neutral" && <line x1="76" y1="116" x2="84" y2="116" stroke={ink} strokeWidth="2" />}
        {mood === "curious" && <circle cx="80" cy="116" r="2.5" fill={ink} />}
        {mood === "sleep"   && <line x1="76" y1="118" x2="84" y2="118" stroke={ink} strokeWidth="2" />}
        {/* Feet */}
        <ellipse cx="60" cy="150" rx="9" ry="3.5" fill={ink} />
        <ellipse cx="100" cy="150" rx="9" ry="3.5" fill={ink} />
        {mood === "sleep" && <SleepMark x={126} y={42} ink={ink} />}
      </svg>
    );
  },
});
