export type TextFormat = "md" | "txt" | "json" | "yaml";

export type Classification =
  | { kind: "epub" }
  | { kind: "pdf" }
  | { kind: "text"; format: TextFormat }
  | { kind: "docx" }
  | { kind: "doc" };

export const SUPPORTED_EXTS = [
  "epub",
  "pdf",
  "md",
  "markdown",
  "txt",
  "json",
  "yaml",
  "yml",
  "docx",
  "doc",
] as const;

export function classifyExt(rawExt: string): Classification | null {
  const ext = rawExt.toLowerCase();
  if (ext === "epub") return { kind: "epub" };
  if (ext === "pdf") return { kind: "pdf" };
  if (ext === "md" || ext === "markdown") return { kind: "text", format: "md" };
  if (ext === "txt") return { kind: "text", format: "txt" };
  if (ext === "json") return { kind: "text", format: "json" };
  if (ext === "yaml" || ext === "yml") return { kind: "text", format: "yaml" };
  if (ext === "docx") return { kind: "docx" };
  if (ext === "doc") return { kind: "doc" };
  return null;
}

export function classifyPath(path: string): Classification | null {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return null;
  return classifyExt(path.slice(dot + 1));
}
