// types.ts — FurnitureKind interface shared across registered items.

import type { ReactNode } from "react";

export type FurnitureCategory =
  | "storage"
  | "seating"
  | "surface"
  | "lighting"
  | "decor"
  | "window"
  | "rug";

export type FurnitureAnchor = "floor" | "wall";

export type DayPhase = "dawn" | "day" | "dusk" | "night";

/** App-derived values piped into every furniture render. Furniture should
 *  degrade gracefully if a field is missing. */
export type FurnitureState = {
  time: Date;
  dayPhase: DayPhase;
  /** Days in a row of recorded activity. */
  streak: number;
  /** Pages read in the current window — drives bookshelf fill. */
  pagesRead: number;
  /** Words written today — drives desk paper stack. */
  words: number;
  /** Tokens earned today — drives plant growth. */
  tokensToday: number;
  /** Optional; picture frame shows the author. */
  quote: { author: string } | null;
};

export type FurnitureRenderProps = {
  dark: boolean;
  /** Accent color. Furniture may use it (e.g. fireplace flame on streak). */
  accent: string | null;
  state: FurnitureState;
};

export type FurnitureKind = {
  id: string;
  name: string;
  category: FurnitureCategory;
  anchor: FurnitureAnchor;
  size: { w: number; h: number };
  /** Tokens to unlock in a future shop. 0 = free. */
  price: number;
  description: string;
  render: (props: FurnitureRenderProps) => ReactNode;
};
