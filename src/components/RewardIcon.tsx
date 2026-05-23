import { useMemo } from "react";
import tvSvg from "../assets/habits/tv.svg?raw";
import bookSvg from "../assets/habits/book.svg?raw";
import dessertSvg from "../assets/habits/dessert.svg?raw";
import gameSvg from "../assets/habits/game.svg?raw";
import mealSvg from "../assets/habits/meal.svg?raw";
import movieSvg from "../assets/habits/movie.svg?raw";
import dayoffSvg from "../assets/habits/dayoff.svg?raw";
import shoppingSvg from "../assets/habits/shopping.svg?raw";
import sleepSvg from "../assets/habits/sleep.svg?raw";
import bedSvg from "../assets/habits/bed.svg?raw";
import type { IconKey } from "../modes/habits/rewards";

const RAW: Record<IconKey, string> = {
  tv: tvSvg,
  book: bookSvg,
  dessert: dessertSvg,
  game: gameSvg,
  meal: mealSvg,
  movie: movieSvg,
  dayoff: dayoffSvg,
  shopping: shoppingSvg,
  sleep: sleepSvg,
  bed: bedSvg,
};

// Rewrite hardcoded colors in the raw SVG so the icon picks up the wrapper's
// `color` via currentColor. We also strip fixed width/height so the SVG
// scales to its container.
function normalize(svg: string): string {
  return (
    svg
      // 1. Attribute-form colors: fill="#000" → fill="currentColor"
      .replace(/(fill|stroke)="(#[0-9a-fA-F]{3,8}|black)"/gi, '$1="currentColor"')
      // 2. CSS-form colors inside <style> blocks: fill:#000000 → fill:currentColor
      .replace(/(fill|stroke):\s*(#[0-9a-fA-F]{3,8}|black)/gi, "$1:currentColor")
      // 3. On the first <svg ...> opening tag, strip any width/height
      // attributes (regardless of order, and even when the opening tag
      // spans multiple lines) and force the SVG to fill its container
      // span. svgrepo files sometimes write `height` before `width` and
      // wrap the opening tag — without this, the SVG stays at its
      // intrinsic 800×800 and renders only its top-left corner.
      .replace(/<svg\b([^>]*)>/i, (_full, rawAttrs) => {
        const cleaned = rawAttrs.replace(/\s(width|height)\s*=\s*"[^"]*"/gi, "");
        return `<svg${cleaned} width="100%" height="100%">`;
      })
  );
}

type Variant = "owned" | "shop" | "spent";

type Props = {
  iconKey: IconKey;
  variant: Variant;
  /** CSS color used when variant is "owned". Ignored otherwise. */
  color?: string;
  size?: number;
  className?: string;
  /** When true, opacity/filter/color changes animate over ~400ms — used
   *  by the Slot Machine to fade winning tiles from silhouette to color. */
  animateVariantChange?: boolean;
};

/**
 * Renders a reward icon in one of three states:
 *  - "shop":  monochrome, grayscale(1) opacity .55  (unowned, for sale)
 *  - "owned": full color via `color`, opacity 1     (purchased / won)
 *  - "spent": monochrome, grayscale(1) opacity .4   (redeemed / used up)
 */
export function RewardIcon({
  iconKey,
  variant,
  color,
  size = 96,
  className,
  animateVariantChange = false,
}: Props) {
  const html = useMemo(() => normalize(RAW[iconKey]), [iconKey]);

  const style: React.CSSProperties = {
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (variant === "owned") {
    style.color = color ?? "currentColor";
    style.opacity = 1;
    style.filter = "grayscale(0)";
  } else if (variant === "shop") {
    style.filter = "grayscale(1)";
    style.opacity = 0.55;
  } else {
    // spent
    style.filter = "grayscale(1)";
    style.opacity = 0.4;
  }

  if (animateVariantChange) {
    style.transition = "opacity 400ms ease, filter 400ms ease, color 400ms ease";
  }

  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
