import { exists, mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

// Manuscript layout inside a connected vault:
//
//   <vault>/Drafts/
//     _index.json     authoritative metadata (title, order, word count, dates)
//     <id>.md         one file per chapter, first line is "# <Title>"
//
// Filenames are immutable IDs (sortable timestamp + slug), so renaming or
// reordering a chapter never touches the filesystem entry — only _index.json
// changes. That keeps the index as the single source of truth and avoids
// the "user manually renamed a file in Finder, app lost it" trap.

export const DRAFTS_DIRNAME = "Drafts";
export const INDEX_FILENAME = "_index.json";
export const NOTES_DIRNAME = "_notes";
const INDEX_VERSION = 1;
const NOTES_VERSION = 1;

// First N chars of a line, stored with the note so we can re-anchor after
// the writer edits surrounding content. Long enough to be unique within a
// chapter but short enough that small edits to the line don't break it.
export const NOTE_SNIPPET_LEN = 60;

export type ChapterMeta = {
  id: string;
  title: string;
  filename: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

type DraftsIndex = {
  version: number;
  chapters: ChapterMeta[];
};

function draftsDir(vaultPath: string): string {
  return `${vaultPath}/${DRAFTS_DIRNAME}`;
}

function indexPath(vaultPath: string): string {
  return `${draftsDir(vaultPath)}/${INDEX_FILENAME}`;
}

function chapterPath(vaultPath: string, filename: string): string {
  return `${draftsDir(vaultPath)}/${filename}`;
}

function notesDir(vaultPath: string): string {
  return `${draftsDir(vaultPath)}/${NOTES_DIRNAME}`;
}

function notesFilePath(vaultPath: string, chapterId: string): string {
  // Sanitize chapterId defensively so it can never escape the notes dir.
  const safe = chapterId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${notesDir(vaultPath)}/${safe}.json`;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "untitled"
  );
}

// Filename = sortable timestamp + slug + .md. The timestamp prefix means a
// raw `ls` matches creation order even if _index.json is missing.
function newFilename(title: string, now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${stamp}-${slugify(title)}.md`;
}

function newId(): string {
  // Short opaque id — index is the source of truth, this just disambiguates.
  return "ch_" + Math.random().toString(36).slice(2, 10);
}

function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

// "# Title\n\nbody..." round-trip. If the file is missing the H1, we treat
// the entire file as body and fall back to the index's title.
function buildBody(title: string, content: string): string {
  const trimmed = content.replace(/^\s+/, "");
  return `# ${title}\n\n${trimmed}`;
}

function stripLeadingH1(raw: string): string {
  // Drop a single leading "# ..." line (and the blank line right after it
  // if present) so the editor shows only the body.
  return raw.replace(/^#\s+[^\n]*\n(\n)?/, "");
}

async function ensureDraftsDir(vaultPath: string): Promise<void> {
  const dir = draftsDir(vaultPath);
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
}

function emptyIndex(): DraftsIndex {
  return { version: INDEX_VERSION, chapters: [] };
}

async function readIndexFile(vaultPath: string): Promise<DraftsIndex> {
  const p = indexPath(vaultPath);
  if (!(await exists(p))) return emptyIndex();
  try {
    const raw = await readTextFile(p);
    const parsed = JSON.parse(raw) as Partial<DraftsIndex>;
    if (!parsed || !Array.isArray(parsed.chapters)) return emptyIndex();
    return { version: INDEX_VERSION, chapters: parsed.chapters as ChapterMeta[] };
  } catch {
    return emptyIndex();
  }
}

async function writeIndexFile(vaultPath: string, index: DraftsIndex): Promise<void> {
  await ensureDraftsDir(vaultPath);
  await writeTextFile(indexPath(vaultPath), JSON.stringify(index, null, 2));
}

// If _index.json is missing but Drafts/*.md exist (e.g. user copied an old
// vault, or the index file was deleted), rebuild a minimal index from the
// filesystem so the chapter list isn't blank.
async function reconcileWithDisk(
  vaultPath: string,
  index: DraftsIndex,
): Promise<DraftsIndex> {
  const dir = draftsDir(vaultPath);
  if (!(await exists(dir))) return index;
  let entries: { name: string }[];
  try {
    entries = await readDir(dir);
  } catch {
    return index;
  }
  const onDisk = entries
    .map((e) => e.name)
    .filter((n) => n.endsWith(".md") && !n.startsWith("_"));

  if (index.chapters.length > 0) return index;
  if (onDisk.length === 0) return index;

  const rebuilt: ChapterMeta[] = [];
  for (const filename of onDisk.sort()) {
    try {
      const raw = await readTextFile(chapterPath(vaultPath, filename));
      const titleMatch = raw.match(/^#\s+(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, "");
      const body = stripLeadingH1(raw);
      rebuilt.push({
        id: newId(),
        title,
        filename,
        wordCount: countWords(body),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      /* skip unreadable */
    }
  }
  const rebuiltIndex = { version: INDEX_VERSION, chapters: rebuilt };
  await writeIndexFile(vaultPath, rebuiltIndex);
  return rebuiltIndex;
}

/** Reads the chapter index, reconciling with disk if the index is missing
 *  but chapter files exist. Always returns a valid index. */
export async function loadIndex(vaultPath: string): Promise<ChapterMeta[]> {
  await ensureDraftsDir(vaultPath);
  const idx = await readIndexFile(vaultPath);
  const final = await reconcileWithDisk(vaultPath, idx);
  return final.chapters;
}

/** Reads a single chapter's body (with the leading "# Title" stripped). */
export async function loadChapter(
  vaultPath: string,
  filename: string,
): Promise<string> {
  const p = chapterPath(vaultPath, filename);
  if (!(await exists(p))) return "";
  const raw = await readTextFile(p);
  return stripLeadingH1(raw);
}

/** Writes the chapter file and updates the matching index entry's word count
 *  and `updatedAt`. Throws if the chapter is missing from the index. */
export async function saveChapter(
  vaultPath: string,
  chapterId: string,
  content: string,
): Promise<ChapterMeta> {
  await ensureDraftsDir(vaultPath);
  const idx = await readIndexFile(vaultPath);
  const i = idx.chapters.findIndex((c) => c.id === chapterId);
  if (i < 0) throw new Error(`Chapter ${chapterId} not in index`);
  const chapter = idx.chapters[i];
  await writeTextFile(
    chapterPath(vaultPath, chapter.filename),
    buildBody(chapter.title, content),
  );
  const updated: ChapterMeta = {
    ...chapter,
    wordCount: countWords(content),
    updatedAt: new Date().toISOString(),
  };
  idx.chapters[i] = updated;
  await writeIndexFile(vaultPath, idx);
  return updated;
}

// ---------------------------------------------------------------------------
// Margin notes — small sticky-note style annotations the writer attaches to
// a specific line of a chapter. Stored per chapter in Drafts/_notes/.
// ---------------------------------------------------------------------------

export type ChapterNote = {
  id: string;
  body: string;
  // Best-effort line index hint at save time. Used as a quick lookup;
  // anchorSnippet is the authoritative anchor when the index goes stale.
  lineIdx: number;
  // First NOTE_SNIPPET_LEN chars of the anchored line, whitespace-collapsed
  // and lowercased, for fuzzy re-anchoring after edits.
  anchorSnippet: string;
  createdAt: string;
  updatedAt: string;
};

type NotesFile = {
  version: number;
  notes: ChapterNote[];
};

/** Normalize a line for snippet matching: collapse whitespace, lowercase,
 *  trim. Two lines with the same "intent" should produce the same snippet. */
export function normalizeForAnchor(line: string): string {
  return line.replace(/\s+/g, " ").trim().toLowerCase().slice(0, NOTE_SNIPPET_LEN);
}

async function ensureNotesDir(vaultPath: string): Promise<void> {
  const dir = notesDir(vaultPath);
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
}

/** Reads a chapter's notes. Returns an empty list if the file doesn't
 *  exist or is malformed — never throws, since a missing notes file is
 *  the normal case for a brand-new chapter. */
export async function loadNotes(
  vaultPath: string,
  chapterId: string,
): Promise<ChapterNote[]> {
  const p = notesFilePath(vaultPath, chapterId);
  if (!(await exists(p))) return [];
  try {
    const raw = await readTextFile(p);
    const parsed = JSON.parse(raw) as Partial<NotesFile>;
    if (!parsed || !Array.isArray(parsed.notes)) return [];
    return parsed.notes as ChapterNote[];
  } catch {
    return [];
  }
}

/** Writes the full notes list for a chapter, overwriting whatever was
 *  there. Caller is responsible for passing the desired final state. */
export async function saveNotes(
  vaultPath: string,
  chapterId: string,
  notes: ChapterNote[],
): Promise<void> {
  await ensureDraftsDir(vaultPath);
  await ensureNotesDir(vaultPath);
  const body: NotesFile = { version: NOTES_VERSION, notes };
  await writeTextFile(notesFilePath(vaultPath, chapterId), JSON.stringify(body, null, 2));
}

/** Creates a new chapter file + index entry, returns its metadata. */
export async function createChapter(
  vaultPath: string,
  title: string,
): Promise<ChapterMeta> {
  await ensureDraftsDir(vaultPath);
  const idx = await readIndexFile(vaultPath);
  const clean = title.trim() || "Untitled Chapter";
  const now = new Date().toISOString();
  const meta: ChapterMeta = {
    id: newId(),
    title: clean,
    filename: newFilename(clean),
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await writeTextFile(chapterPath(vaultPath, meta.filename), buildBody(clean, ""));
  idx.chapters.push(meta);
  await writeIndexFile(vaultPath, idx);
  return meta;
}
