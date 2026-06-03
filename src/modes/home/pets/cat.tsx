// cat.tsx — Borges. Elongated, slit-eyed, contemplative.

import { registerPet } from "./registry";
import { inks, pupil, shouldShowAccent, SleepMark } from "./helpers";

registerPet({
  id: "cat",
  name: "Borges",
  species: "Cat",
  credo: "Will defeat you at chess and at metaphor.",
  mbtiTypes: ["INTP", "ISTP"],
  aspect: 1.0,
  render: ({ mood, blink, gaze, hunger, dark, accent }) => {
    const { ink, bg } = inks(dark);
    const cc = shouldShowAccent({ mood, hunger, accent }) ? (accent as string) : ink;
    const p = pupil(gaze, 3, 2);
    const sleeping = mood === "sleep";
    return (
      <svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* Tail */}
        <line x1="160" y1="140" x2="186" y2="78" stroke={ink} strokeWidth="2.5" />
        <circle cx="186" cy="76" r="3" fill={ink} />
        {/* Body */}
        <ellipse cx="100" cy="140" rx="62" ry="26" fill={bg} stroke={ink} strokeWidth="2" />
        {/* Legs */}
        <rect x="58" y="158" width="6" height="14" fill={ink} />
        <rect x="76" y="158" width="6" height="14" fill={ink} />
        <rect x="118" y="158" width="6" height="14" fill={ink} />
        <rect x="136" y="158" width="6" height="14" fill={ink} />
        {/* Head */}
        <circle cx="80" cy="86" r="36" fill={bg} stroke={ink} strokeWidth="2" />
        {/* Ears */}
        <line x1="56" y1="60" x2="48" y2="36" stroke={ink} strokeWidth="2" />
        <line x1="56" y1="60" x2="64" y2="50" stroke={ink} strokeWidth="2" />
        <line x1="104" y1="60" x2="112" y2="36" stroke={ink} strokeWidth="2" />
        <line x1="104" y1="60" x2="96" y2="50" stroke={ink} strokeWidth="2" />
        {/* Eyes — slits when blinking/sleeping/happy */}
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
        {/* Whiskers */}
        <line x1="38" y1="98"  x2="58" y2="100" stroke={ink} strokeWidth="1.2" />
        <line x1="38" y1="104" x2="58" y2="104" stroke={ink} strokeWidth="1.2" />
        <line x1="102" y1="100" x2="122" y2="98"  stroke={ink} strokeWidth="1.2" />
        <line x1="102" y1="104" x2="122" y2="104" stroke={ink} strokeWidth="1.2" />
        {/* Nose + mouth */}
        <ellipse cx="80" cy="96" rx="2.5" ry="2" fill={ink} />
        {mood === "hungry"  && <ellipse cx="80" cy="106" rx="4" ry="3" fill={ink} />}
        {mood === "happy"   && <line x1="74" y1="104" x2="86" y2="104" stroke={ink} strokeWidth="2" />}
        {mood === "neutral" && <line x1="76" y1="104" x2="84" y2="104" stroke={ink} strokeWidth="1.5" />}
        {mood === "curious" && <circle cx="80" cy="104" r="2" fill={ink} />}
        {/* Color reward: collar bell */}
        {mood === "happy" && hunger > 50 && (
          <>
            <line x1="62" y1="122" x2="98" y2="122" stroke={cc} strokeWidth="2" />
            <circle cx="80" cy="126" r="3" fill={cc} />
          </>
        )}
        {sleeping && <SleepMark x={130} y={44} ink={ink} />}
      </svg>
    );
  },
});
