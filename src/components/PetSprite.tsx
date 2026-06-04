// PetSprite.tsx — Pet shell. Looks up a registered kind by id and delegates
// rendering. The shell owns the behavior hook so kinds stay pure.

import { useRef, type RefObject } from "react";
import {
  defaultPetKind,
  getPetKind,
  type PetMood,
} from "../modes/home/pets";
import type { IllustrationTone } from "../modes/home/illustration";
import { usePetBehavior } from "../state/usePetBehavior";
import { useTheme } from "../state/ThemeContext";

type Props = {
  /** Registered pet id. Falls back to defaultPetKind() if missing. */
  kindId?: string;
  mood?: PetMood;
  hunger?: number;
  /** Width in px. Height derives from kind.aspect. */
  size?: number;
  /** Accent color — applied only when mood='happy' AND hunger>50. */
  color?: string | null;
  /** Mono is the app default; color is available for illustration previews. */
  tone?: IllustrationTone;
  /** Override dark mode. Defaults to useTheme().dark. */
  dark?: boolean;
  /** When true, registers cursor/keyboard listeners for gaze + sleep. */
  follow?: boolean;
  /** Optional ref used for gaze geometry; an internal ref is used otherwise. */
  hostRef?: RefObject<HTMLDivElement | null>;
};

export function PetSprite({
  kindId,
  mood: moodProp = "neutral",
  hunger = 70,
  size = 180,
  color = null,
  tone = "mono",
  dark: darkProp,
  follow = true,
  hostRef: hostRefProp,
}: Props) {
  const { dark: themeDark } = useTheme();
  const dark = darkProp ?? themeDark;
  const localRef = useRef<HTMLDivElement | null>(null);
  const hostRef = hostRefProp ?? localRef;
  const kind = (kindId && getPetKind(kindId)) || defaultPetKind();
  const { blink, gaze, sleeping } = usePetBehavior({ hostRef, follow });

  if (!kind) {
    return (
      <div
        ref={hostRef}
        className="border border-dashed border-current flex items-center justify-center font-mono text-[10px]"
        style={{ width: size, height: size }}
      >
        no pet registered
      </div>
    );
  }

  const mood: PetMood = sleeping && follow ? "sleep" : moodProp;
  const height = size * kind.aspect;
  return (
    <div
      ref={hostRef}
      className="inline-block select-none"
      style={{ width: size, height }}
    >
      {kind.render({ mood, blink, gaze, hunger, dark, accent: color, tone })}
    </div>
  );
}
