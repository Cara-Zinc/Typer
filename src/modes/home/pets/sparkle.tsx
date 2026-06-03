// sparkle.tsx — *. Pure typography. The Claude-CLI homage.
//
// Renderer returns a <div> instead of an <svg> — the registry interface
// accepts any ReactNode. Use this pattern when a pet is fundamentally
// glyph-based.

import { registerPet } from "./registry";
import { inks, shouldShowAccent } from "./helpers";

registerPet({
  id: "sparkle",
  name: "*",
  species: "Sparkle",
  credo: "Reads with you. Says little.",
  mbtiTypes: ["INFJ"],
  aspect: 1.0,
  render: ({ mood, blink, hunger, dark, accent }) => {
    const { ink, bg } = inks(dark);
    const cc = shouldShowAccent({ mood, hunger, accent }) ? (accent as string) : ink;
    const sleeping = mood === "sleep";
    const glyph =
      sleeping            ? "·" :
      mood === "happy"    ? "✦" :
      mood === "hungry"   ? "○" :
      mood === "curious"  ? "◇" :
                            "✱";
    return (
      <div style={{ containerType: "size" }} className="w-full h-full flex items-center justify-center font-mono select-none relative" >
        <span
          style={{
            color: cc,
            background: bg,
            fontSize: "min(70cqw, 70cqh)",
            lineHeight: 1,
            opacity: blink ? 0.55 : 1,
            display: "inline-block",
            animation: "sparkle-breathe 2.6s ease-in-out infinite",
            transition: "opacity 150ms",
          }}
        >
          {glyph}
        </span>
        {sleeping && (
          <span style={{ color: ink }} className="absolute top-[12%] right-[20%] text-[20%] opacity-60">z</span>
        )}
        <style>{`@keyframes sparkle-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }`}</style>
      </div>
    );
  },
});
