// PetBubble.tsx — Speech bubble with a single black-square "tail".

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Which side the tail sticks out on. The tail visually attaches to the
   *  speaker (so a pet on the right → tail on "right" pointing right). */
  side?: "left" | "right";
  font?: "serif" | "mono";
};

export function PetBubble({ children, side = "right", font = "serif" }: Props) {
  // Tail is an absolutely-positioned 12×12 div rotated 45deg. We give it
  // only two borders (the two facing away from the bubble body) so it
  // reads as a continuous outline with the bubble's border.
  const tailPositional =
    side === "right"
      ? { left: -7, borderRight: "none" }
      : { right: -7, borderLeft: "none" };
  return (
    <div
      className={[
        "relative border border-black dark:border-white",
        "bg-white dark:bg-black text-black dark:text-white",
        "px-3.5 py-2.5 text-[13px] leading-snug max-w-[280px]",
        font === "serif" ? "font-serif italic" : "font-mono",
      ].join(" ")}
    >
      {children}
      <span
        aria-hidden
        className="absolute bottom-3.5 w-3 h-3 bg-white dark:bg-black border-t border-black dark:border-white"
        style={{ transform: "rotate(45deg)", ...tailPositional }}
      />
    </div>
  );
}
