export type IllustrationTone = "mono" | "color";

export type IllustrationPalette = {
  ink: string;
  bg: string;
  paper: string;
  wash: string;
  shade: string;
  shadow: string;
  accent: string;
  warm: string;
  leaf: string;
  ember: string;
};

export function illustrationPalette(
  dark: boolean,
  tone: IllustrationTone = "mono",
  accent: string | null = null,
): IllustrationPalette {
  const ink = dark ? "#fff" : "#000";
  const bg = dark ? "#000" : "#fff";
  if (tone === "color") {
    return {
      ink,
      bg,
      paper: dark ? "#15120d" : "#f7f1df",
      wash: dark ? "#2b2a24" : "#d9d3c3",
      shade: dark ? "#6f6656" : "#8b8172",
      shadow: dark ? "#0b0b0b" : "#c8c0b3",
      accent: accent ?? "#8c6a35",
      warm: "#a87635",
      leaf: "#5f7158",
      ember: "#b04b2f",
    };
  }
  return {
    ink,
    bg,
    paper: bg,
    wash: dark ? "#1b1b1b" : "#e9e9e9",
    shade: dark ? "#a8a8a8" : "#5a5a5a",
    shadow: dark ? "#242424" : "#d4d4d4",
    accent: dark ? "#d8d8d8" : "#3f3f3f",
    warm: dark ? "#cfcfcf" : "#444",
    leaf: dark ? "#c8c8c8" : "#4a4a4a",
    ember: dark ? "#eee" : "#111",
  };
}
