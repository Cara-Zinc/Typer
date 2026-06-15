import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  BookText,
  Check,
  Feather,
  Keyboard,
  MessageSquarePlus,
  Plus,
  Save,
  StickyNote,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useVault } from "../state/VaultContext";
import {
  createChapter,
  loadChapter,
  loadIndex,
  loadNotes,
  normalizeForAnchor,
  saveChapter,
  saveNotes,
  type ChapterMeta,
  type ChapterNote,
} from "../state/drafts";

// --- Keyboard layout ---
// Five rows, all uniform circle keys (matches the typewriter aesthetic).
// Long modifier names are replaced with Mac-style symbols:
//   shift → ⇧   caps lock → ⇪   tab → ⇥   return → ⏎   delete → ⌫
//   command → ⌘   option → ⌥   control → ⌃   arrows → ← ↑ ↓ →
// The spacebar is the only non-circle element (a long stadium).
const KEY_UNIT = 52; // horizontal slot per 1u key
const KEY_RADIUS = 22;
const SPACE_WIDTH_U = 5; // spacebar takes 5 slots

type KeyDef =
  | { kind: "circle"; label: string; data: string }
  | { kind: "space" };

const ROWS: ReadonlyArray<{ y: number; keys: KeyDef[] }> = [
  {
    y: 565,
    keys: [
      { kind: "circle", label: "`", data: "`" },
      { kind: "circle", label: "1", data: "1" },
      { kind: "circle", label: "2", data: "2" },
      { kind: "circle", label: "3", data: "3" },
      { kind: "circle", label: "4", data: "4" },
      { kind: "circle", label: "5", data: "5" },
      { kind: "circle", label: "6", data: "6" },
      { kind: "circle", label: "7", data: "7" },
      { kind: "circle", label: "8", data: "8" },
      { kind: "circle", label: "9", data: "9" },
      { kind: "circle", label: "0", data: "0" },
      { kind: "circle", label: "-", data: "-" },
      { kind: "circle", label: "=", data: "=" },
      { kind: "circle", label: "⌫", data: "Backspace" },
    ],
  },
  {
    y: 630,
    keys: [
      { kind: "circle", label: "⇥", data: "Tab" },
      { kind: "circle", label: "Q", data: "Q" },
      { kind: "circle", label: "W", data: "W" },
      { kind: "circle", label: "E", data: "E" },
      { kind: "circle", label: "R", data: "R" },
      { kind: "circle", label: "T", data: "T" },
      { kind: "circle", label: "Y", data: "Y" },
      { kind: "circle", label: "U", data: "U" },
      { kind: "circle", label: "I", data: "I" },
      { kind: "circle", label: "O", data: "O" },
      { kind: "circle", label: "P", data: "P" },
      { kind: "circle", label: "[", data: "[", },
      { kind: "circle", label: "]", data: "]", },
      { kind: "circle", label: "\\", data: "\\" },
    ],
  },
  {
    y: 695,
    keys: [
      { kind: "circle", label: "⇪", data: "CapsLock" },
      { kind: "circle", label: "A", data: "A" },
      { kind: "circle", label: "S", data: "S" },
      { kind: "circle", label: "D", data: "D" },
      { kind: "circle", label: "F", data: "F" },
      { kind: "circle", label: "G", data: "G" },
      { kind: "circle", label: "H", data: "H" },
      { kind: "circle", label: "J", data: "J" },
      { kind: "circle", label: "K", data: "K" },
      { kind: "circle", label: "L", data: "L" },
      { kind: "circle", label: ";", data: ";" },
      { kind: "circle", label: "'", data: "'" },
      { kind: "circle", label: "⏎", data: "Enter" },
    ],
  },
  {
    y: 760,
    keys: [
      { kind: "circle", label: "⇧", data: "ShiftL" },
      { kind: "circle", label: "Z", data: "Z" },
      { kind: "circle", label: "X", data: "X" },
      { kind: "circle", label: "C", data: "C" },
      { kind: "circle", label: "V", data: "V" },
      { kind: "circle", label: "B", data: "B" },
      { kind: "circle", label: "N", data: "N" },
      { kind: "circle", label: "M", data: "M" },
      { kind: "circle", label: ",", data: "," },
      { kind: "circle", label: ".", data: "." },
      { kind: "circle", label: "/", data: "/" },
      { kind: "circle", label: "⇧", data: "ShiftR" },
    ],
  },
  {
    y: 825,
    keys: [
      { kind: "circle", label: "fn", data: "Fn" },
      { kind: "circle", label: "⌃", data: "CtrlL" },
      { kind: "circle", label: "⌥", data: "AltL" },
      { kind: "circle", label: "⌘", data: "MetaL" },
      { kind: "space" },
      { kind: "circle", label: "⌘", data: "MetaR" },
      { kind: "circle", label: "⌥", data: "AltR" },
      { kind: "circle", label: "←", data: "ArrowLeft" },
      { kind: "circle", label: "↑", data: "ArrowUp" },
      { kind: "circle", label: "↓", data: "ArrowDown" },
      { kind: "circle", label: "→", data: "ArrowRight" },
    ],
  },
];

// Maps KeyboardEvent.code to the data-letter we used on the SVG key. This
// keeps the visual SVG decoupled from W3C key code naming.
const CODE_TO_DATA: Record<string, string> = {
  // Symbols
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  // Modifiers
  Tab: "Tab",
  CapsLock: "CapsLock",
  ShiftLeft: "ShiftL",
  ShiftRight: "ShiftR",
  Backspace: "Backspace",
  Enter: "Enter",
  ControlLeft: "CtrlL",
  ControlRight: "CtrlL",
  AltLeft: "AltL",
  AltRight: "AltR",
  MetaLeft: "MetaL",
  MetaRight: "MetaR",
  Fn: "Fn",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
};

const CARRIAGE_STEP = 4;
const CARRIAGE_WRAP = 28;
type WritingInstrument = "typewriter" | "keyboard" | "quill";
const INSTRUMENT_STORAGE_KEY = "triptych.typer.instrument";
const WRITING_INSTRUMENTS: Array<{
  id: WritingInstrument;
  label: string;
  icon: typeof Type;
}> = [
  { id: "typewriter", label: "Typewriter", icon: Type },
  { id: "keyboard", label: "Keyboard", icon: Keyboard },
  { id: "quill", label: "Quill", icon: Feather },
];

function isWritingInstrument(value: string | null): value is WritingInstrument {
  return value === "typewriter" || value === "keyboard" || value === "quill";
}

// Relative-time formatter for the chapter list. Keeps the sidebar tight —
// "2h" instead of "Jun 9, 2026, 5:43 PM". Falls back to date for >1w.
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h`;
  if (diffSec < 604800) return `${Math.round(diffSec / 86400)}d`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function Typer() {
  const { vaultPath, loaded: vaultLoaded } = useVault();
  const [instrument, setInstrument] = useState<WritingInstrument>(() => {
    const stored = localStorage.getItem(INSTRUMENT_STORAGE_KEY);
    return isWritingInstrument(stored) ? stored : "typewriter";
  });
  const [quillMotion, setQuillMotion] = useState<{
    kind: "idle" | "stroke" | "dip";
    tick: number;
  }>({ kind: "idle", tick: 0 });

  // --- Chapter / persistence state ---
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Inline "new chapter" input visibility + draft title.
  const [newChapterTitle, setNewChapterTitle] = useState<string | null>(null);
  // Suppress the dirty flag while we're loading a chapter into the editor
  // — the resulting setText() would otherwise look like the user typed.
  const suppressDirtyRef = useRef(false);

  // --- Margin notes ---
  // Notes for the *active* chapter. Loaded on chapter switch, persisted on
  // every change. Cards in the right margin are positioned by the layout
  // effect based on each note's resolved anchor line.
  const [notes, setNotes] = useState<ChapterNote[]>([]);
  // Which line is currently under the cursor — drives the floating "+ note"
  // button. null when not hovering any non-empty line, or when an editor
  // card is already open.
  const [hoveredLineIdx, setHoveredLineIdx] = useState<number | null>(null);
  // Editor card state. editingNoteId is either an existing note's id, or
  // the sentinel "new:<lineIdx>" for a brand-new note attached to that line.
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const linesContainerRef = useRef<HTMLDivElement>(null);
  const plusBtnRef = useRef<HTMLButtonElement>(null);
  // Per-note card refs so the layout effect can position them after render
  // without going through React state (avoids a position-feedback loop).
  const noteCardRefsRef = useRef(new Map<string, HTMLDivElement>());
  // Bump to force the layout effect to re-run on window resize.
  const [layoutTick, setLayoutTick] = useState(0);

  // --- Typewriter editor state (unchanged from original) ---
  const [text, setText] = useState("");
  const [caretIndex, setCaretIndex] = useState(0);
  const [animIndex, setAnimIndex] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const carriagePosRef = useRef(0);
  const newTitleInputRef = useRef<HTMLInputElement>(null);

  const syncCaretFromCapture = useCallback(() => {
    const el = captureRef.current;
    if (!el) return;
    const caret =
      el.selectionDirection === "backward" ? el.selectionStart : el.selectionEnd;
    setCaretIndex(Math.min(text.length, Math.max(0, caret)));
  }, [text.length]);

  const syncCaretAfterEvent = useCallback(() => {
    requestAnimationFrame(syncCaretFromCapture);
  }, [syncCaretFromCapture]);

  const placeCaptureCaret = useCallback((index: number) => {
    setCaretIndex(Math.max(0, index));
    requestAnimationFrame(() => {
      const el = captureRef.current;
      if (!el) return;
      const pos = Math.min(el.value.length, Math.max(0, index));
      el.setSelectionRange(pos, pos);
    });
  }, []);

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === activeId) ?? null,
    [chapters, activeId],
  );

  // Refs mirror current state for use inside auto-save closures. Reading
  // these instead of state means the closure doesn't go stale between
  // renders, so a chapter switch always saves the *current* buffer.
  const textRef = useRef(text);
  const dirtyRef = useRef(dirty);
  const activeIdRef = useRef(activeId);
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => {
    localStorage.setItem(INSTRUMENT_STORAGE_KEY, instrument);
  }, [instrument]);

  // ----- Vault load: read the chapter index whenever the vault changes -----
  useEffect(() => {
    if (!vaultLoaded) return;
    if (!vaultPath) {
      setChapters([]);
      setActiveId(null);
      setText("");
      placeCaptureCaret(0);
      setDirty(false);
      return;
    }
    (async () => {
      try {
        const list = await loadIndex(vaultPath);
        setChapters(list);
        // Auto-open the most recently edited chapter, if any. Compare by
        // updatedAt timestamp — chapters can be in any order in the index.
        if (list.length > 0) {
          const newest = list.reduce((a, b) =>
            new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime() ? a : b,
          );
          const body = await loadChapter(vaultPath, newest.filename);
          suppressDirtyRef.current = true;
          setText(body);
          placeCaptureCaret(body.length);
          setActiveId(newest.id);
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    })();
    // We intentionally re-run only when vaultPath changes — picking a new
    // vault should reload chapters from scratch.
  }, [vaultLoaded, vaultPath, placeCaptureCaret]);

  // Save the current buffer if dirty. Used by manual Save and by the
  // auto-save-then-switch flow. No-op if there's no vault or active chapter.
  const flushSave = useCallback(async (): Promise<boolean> => {
    if (!vaultPath) return true;
    const id = activeIdRef.current;
    if (!id) return true;
    if (!dirtyRef.current) return true;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await saveChapter(vaultPath, id, textRef.current);
      setChapters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setDirty(false);
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [vaultPath]);

  const handleManualSave = useCallback(() => {
    void flushSave();
  }, [flushSave]);

  // Switch chapters: auto-save the current one first, then load the new.
  // If save fails, abort the switch so we don't silently lose edits.
  const handlePickChapter = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) return;
      const ok = await flushSave();
      if (!ok) return;
      if (!vaultPath) return;
      const meta = chapters.find((c) => c.id === id);
      if (!meta) return;
      try {
        const body = await loadChapter(vaultPath, meta.filename);
        suppressDirtyRef.current = true;
        setText(body);
        placeCaptureCaret(body.length);
        setActiveId(id);
        carriagePosRef.current = 0;
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    },
    [vaultPath, chapters, flushSave, placeCaptureCaret],
  );

  const beginNewChapter = useCallback(() => {
    setNewChapterTitle("");
    // Defer focus to the next tick so the input has mounted.
    setTimeout(() => newTitleInputRef.current?.focus(), 0);
  }, []);

  const cancelNewChapter = useCallback(() => {
    setNewChapterTitle(null);
  }, []);

  const confirmNewChapter = useCallback(async () => {
    if (!vaultPath) return;
    const title = (newChapterTitle ?? "").trim();
    if (!title) {
      setNewChapterTitle(null);
      return;
    }
    // Auto-save the chapter we're leaving before swapping in the new one.
    const ok = await flushSave();
    if (!ok) return;
    try {
      const meta = await createChapter(vaultPath, title);
      setChapters((prev) => [...prev, meta]);
      suppressDirtyRef.current = true;
      setText("");
      placeCaptureCaret(0);
      setActiveId(meta.id);
      setNewChapterTitle(null);
      carriagePosRef.current = 0;
      // Focus the editor so the user can immediately start typing.
      setTimeout(() => captureRef.current?.focus(), 0);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }, [vaultPath, newChapterTitle, flushSave, placeCaptureCaret]);

  // ----- Line parsing (text -> per-line records) -----
  // Each line tracks its starting char offset (for animation indexing) and
  // a normalized snippet (for note re-anchoring). Empty lines are kept so
  // the visual paper matches the textarea overlay line-for-line.
  type ParsedLine = {
    text: string;
    lineStart: number;
    snippet: string;
    isEmpty: boolean;
  };
  const parsedLines = useMemo<ParsedLine[]>(() => {
    const out: ParsedLine[] = [];
    const raw = text.split("\n");
    let cursor = 0;
    for (const lt of raw) {
      const snippet = normalizeForAnchor(lt);
      out.push({
        text: lt,
        lineStart: cursor,
        snippet,
        isEmpty: snippet.length === 0,
      });
      cursor += lt.length + 1;
    }
    return out;
  }, [text]);

  // Find which line a note currently belongs to. Resolution priority:
  //   1. lineIdx hint still matches snippet → return it.
  //   2. Exact snippet match anywhere in the chapter → return that line.
  //   3. Prefix-only fuzzy match (light edits to the line) → return that.
  //   4. Otherwise null (orphan — paragraph was deleted or heavily edited).
  const resolveAnchor = useCallback(
    (note: ChapterNote): number | null => {
      const lines = parsedLines;
      if (note.lineIdx >= 0 && note.lineIdx < lines.length) {
        if (lines[note.lineIdx].snippet === note.anchorSnippet) return note.lineIdx;
      }
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].snippet === note.anchorSnippet) return i;
      }
      const prefix = note.anchorSnippet.slice(0, 30);
      if (prefix.length >= 10) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].snippet.startsWith(prefix)) return i;
        }
      }
      return null;
    },
    [parsedLines],
  );

  // Notes grouped by anchor state for rendering.
  const { anchoredNotes, orphanNotes } = useMemo(() => {
    const anchored: { note: ChapterNote; lineIdx: number }[] = [];
    const orphan: ChapterNote[] = [];
    for (const n of notes) {
      const idx = resolveAnchor(n);
      if (idx === null) orphan.push(n);
      else anchored.push({ note: n, lineIdx: idx });
    }
    return { anchoredNotes: anchored, orphanNotes: orphan };
  }, [notes, resolveAnchor]);

  // ----- Load notes whenever the active chapter changes -----
  useEffect(() => {
    if (!vaultPath || !activeId) {
      setNotes([]);
      setEditingNoteId(null);
      setEditingDraft("");
      return;
    }
    (async () => {
      try {
        const loaded = await loadNotes(vaultPath, activeId);
        setNotes(loaded);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [vaultPath, activeId]);

  // Window resize → re-run layout effect to reposition cards.
  useEffect(() => {
    const onResize = () => setLayoutTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ----- Layout effect: position floating note cards + the "+" button -----
  // Reads each line's bounding box and applies inline top styles directly
  // to DOM nodes. Direct DOM writes avoid the setState feedback loop a
  // position-in-state approach would create.
  useLayoutEffect(() => {
    const container = linesContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const topForLine = (lineIdx: number): number | null => {
      const el = container.querySelector<HTMLDivElement>(
        `[data-typer-line="${lineIdx}"]`,
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.top - containerRect.top;
    };

    // Note cards (including the in-progress new-note editor, which lives
    // in the same ref registry under the sentinel "new:<lineIdx>" key).
    for (const [noteId, cardEl] of noteCardRefsRef.current) {
      let lineIdx: number | null = null;
      if (noteId.startsWith("new:")) {
        lineIdx = parseInt(noteId.slice(4), 10);
      } else {
        const entry = anchoredNotes.find((e) => e.note.id === noteId);
        lineIdx = entry ? entry.lineIdx : null;
      }
      if (lineIdx === null) {
        cardEl.style.display = "none";
        continue;
      }
      const top = topForLine(lineIdx);
      if (top === null) {
        cardEl.style.display = "none";
        continue;
      }
      cardEl.style.display = "";
      cardEl.style.top = `${top}px`;
    }

    // Floating + button
    if (plusBtnRef.current) {
      if (hoveredLineIdx === null || editingNoteId !== null) {
        plusBtnRef.current.style.display = "none";
      } else {
        const top = topForLine(hoveredLineIdx);
        if (top === null) {
          plusBtnRef.current.style.display = "none";
        } else {
          plusBtnRef.current.style.display = "";
          plusBtnRef.current.style.top = `${top}px`;
        }
      }
    }
  }, [
    text,
    anchoredNotes,
    hoveredLineIdx,
    editingNoteId,
    parsedLines.length,
    layoutTick,
  ]);

  // Detect which line the mouse is over. Runs through the textarea since
  // mousemove bubbles up to the container. Only flips state when the line
  // under the cursor actually changes, to keep render churn low.
  const handlePaperMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (editingNoteId !== null) return;
      const container = linesContainerRef.current;
      if (!container) return;
      const y = e.clientY;
      const lines = container.querySelectorAll<HTMLDivElement>("[data-typer-line]");
      let found: number | null = null;
      for (const el of lines) {
        const r = el.getBoundingClientRect();
        if (y >= r.top && y < r.bottom) {
          const idx = parseInt(el.getAttribute("data-typer-line") || "-1", 10);
          // Only non-empty lines get the + button — empty lines are
          // structural whitespace, nothing to annotate.
          if (parsedLines[idx] && !parsedLines[idx].isEmpty) {
            found = idx;
          }
          break;
        }
      }
      if (found !== hoveredLineIdx) setHoveredLineIdx(found);
    },
    [editingNoteId, hoveredLineIdx, parsedLines],
  );

  const handlePaperMouseLeave = useCallback(() => {
    if (hoveredLineIdx !== null) setHoveredLineIdx(null);
  }, [hoveredLineIdx]);

  // ----- Note CRUD -----
  // Persist always writes the whole notes array; the file is small and a
  // single-writer model keeps reasoning simple.
  const persistNotes = useCallback(
    async (next: ChapterNote[]) => {
      if (!vaultPath || !activeId) return;
      try {
        await saveNotes(vaultPath, activeId, next);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    },
    [vaultPath, activeId],
  );

  const beginNewNote = useCallback((lineIdx: number) => {
    setEditingNoteId(`new:${lineIdx}`);
    setEditingDraft("");
    setHoveredLineIdx(null);
  }, []);

  const beginEditNote = useCallback((note: ChapterNote) => {
    setEditingNoteId(note.id);
    setEditingDraft(note.body);
    setHoveredLineIdx(null);
  }, []);

  const cancelEditNote = useCallback(() => {
    setEditingNoteId(null);
    setEditingDraft("");
    setTimeout(() => captureRef.current?.focus(), 0);
  }, []);

  const commitNote = useCallback(async () => {
    const draft = editingDraft.trim();
    if (!editingNoteId) return;
    if (!draft) {
      // Empty body cancels rather than saves an empty card.
      cancelEditNote();
      return;
    }
    const now = new Date().toISOString();
    let next: ChapterNote[];
    if (editingNoteId.startsWith("new:")) {
      const lineIdx = parseInt(editingNoteId.slice(4), 10);
      const line = parsedLines[lineIdx];
      if (!line) {
        cancelEditNote();
        return;
      }
      const note: ChapterNote = {
        id: "n_" + Math.random().toString(36).slice(2, 10),
        body: draft,
        lineIdx,
        anchorSnippet: line.snippet,
        createdAt: now,
        updatedAt: now,
      };
      next = [...notes, note];
    } else {
      next = notes.map((n) =>
        n.id === editingNoteId ? { ...n, body: draft, updatedAt: now } : n,
      );
    }
    setNotes(next);
    setEditingNoteId(null);
    setEditingDraft("");
    await persistNotes(next);
    setTimeout(() => captureRef.current?.focus(), 0);
  }, [editingNoteId, editingDraft, notes, parsedLines, persistNotes, cancelEditNote]);

  const deleteNote = useCallback(
    async (id: string) => {
      const next = notes.filter((n) => n.id !== id);
      setNotes(next);
      if (editingNoteId === id) {
        setEditingNoteId(null);
        setEditingDraft("");
      }
      await persistNotes(next);
    },
    [notes, editingNoteId, persistNotes],
  );

  // Keep the editor focused, scroll the current caret line into view.
  useEffect(() => {
    captureRef.current?.focus();
  }, []);
  useEffect(() => {
    const container = linesContainerRef.current;
    if (!container) {
      const el = paperRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      return;
    }
    const caretLineIdx = parsedLines.findIndex((line) => {
      const lineEnd = line.lineStart + line.text.length;
      return caretIndex >= line.lineStart && caretIndex <= lineEnd;
    });
    const lineEl = container.querySelector<HTMLElement>(
      `[data-typer-line="${Math.max(0, caretLineIdx)}"]`,
    );
    lineEl?.scrollIntoView({ block: "nearest" });
  }, [text.length, caretIndex, parsedLines]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const isSingleInsertion = next.length === text.length + 1;
    const nextCaret = e.target.selectionStart;
    setText(next);
    setCaretIndex(Math.min(next.length, Math.max(0, nextCaret)));
    // First change after a programmatic load is the load itself; don't
    // mark dirty for it. After that, real keystrokes flip dirty=true.
    if (suppressDirtyRef.current) {
      suppressDirtyRef.current = false;
    } else if (vaultPath && activeId) {
      setDirty(true);
    }
    if (isSingleInsertion) {
      setAnimIndex(e.target.selectionStart - 1);
      setAnimKey((k) => k + 1);
      if (instrument === "quill") {
        const inserted = next[nextCaret - 1];
        if (inserted === "\n") animateQuillDip();
        else animateQuillStroke();
      }
    } else if (next.length <= text.length) {
      setAnimIndex(null);
    }
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    if (!e.data || e.data.length === 0) return;
    const cursor = e.currentTarget.selectionStart;
    setCaretIndex(Math.min(e.currentTarget.value.length, Math.max(0, cursor)));
    setAnimIndex(cursor - 1);
    setAnimKey((k) => k + 1);
    if (instrument === "quill") animateQuillStroke();
  };

  const moveCarriage = (chars: number) => {
    const carriage = svgRef.current?.querySelector<SVGGElement>(".typer-carriage");
    if (!carriage) return;
    carriagePosRef.current = chars;
    const offset = -((chars % CARRIAGE_WRAP) * CARRIAGE_STEP);
    carriage.style.transform = `translateX(${offset}px)`;
  };

  const animateKeyEl = (el: SVGGElement) => {
    el.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(3px) scale(0.85)", offset: 0.4 },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 140, easing: "ease-out" },
    );
  };

  const animateQuillStroke = () => {
    setQuillMotion((motion) => ({ kind: "stroke", tick: motion.tick + 1 }));
  };

  const animateQuillDip = () => {
    setQuillMotion((motion) => ({ kind: "dip", tick: motion.tick + 1 }));
  };

  const animateByData = (data: string): boolean => {
    const svg = svgRef.current;
    if (!svg) return false;
    const el = svg.querySelector<SVGGElement>(
      `.typer-key[data-letter="${CSS.escape(data)}"]`,
    );
    if (el) {
      animateKeyEl(el);
      return true;
    }
    return false;
  };

  const animateLetter = (raw: string) => {
    const svg = svgRef.current;
    if (!svg) return;
    const letter = raw.toUpperCase();
    if (animateByData(letter)) return;
    if (animateByData(raw)) return;
    const all = svg.querySelectorAll<SVGGElement>(".typer-key");
    if (all.length > 0 && raw.length > 0) {
      animateKeyEl(all[raw.charCodeAt(0) % all.length]);
    }
  };

  const animateSpace = () => {
    const space = svgRef.current?.querySelector<SVGGElement>(".typer-space");
    space?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(3px)", offset: 0.4 },
        { transform: "translateY(0)" },
      ],
      { duration: 110, easing: "ease-out" },
    );
  };

  const animateLever = () => {
    if (instrument === "quill") {
      animateQuillDip();
      return;
    }
    const lever = svgRef.current?.querySelector<SVGGElement>(".typer-lever");
    lever?.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-32deg)", offset: 0.45 },
        { transform: "rotate(0deg)" },
      ],
      { duration: 380, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const code = e.code;

    // Cmd/Ctrl+S → manual save. Intercept before the textarea sees it.
    if ((e.metaKey || e.ctrlKey) && code === "KeyS") {
      e.preventDefault();
      handleManualSave();
      return;
    }

    if (code === "Enter") {
      animateLever();
      moveCarriage(0);
      if (instrument !== "quill") animateByData("Enter");
      return;
    }
    if (code === "Space") {
      animateSpace();
      moveCarriage(carriagePosRef.current + 1);
      return;
    }
    if (code === "Backspace") {
      moveCarriage(Math.max(0, carriagePosRef.current - 1));
      animateByData("Backspace");
      return;
    }
    if (code === "Tab") {
      e.preventDefault();
      animateByData("Tab");
      return;
    }
    const letterMatch = code.match(/^Key([A-Z])$/);
    if (letterMatch) {
      animateByData(letterMatch[1]);
      moveCarriage(carriagePosRef.current + 1);
      return;
    }
    const digitMatch = code.match(/^Digit(\d)$/);
    if (digitMatch) {
      animateByData(digitMatch[1]);
      moveCarriage(carriagePosRef.current + 1);
      return;
    }
    const mapped = CODE_TO_DATA[code];
    if (mapped) {
      animateByData(mapped);
      const isPrintableSymbol = mapped.length === 1 && !/[A-Z0-9]/.test(mapped);
      if (isPrintableSymbol) moveCarriage(carriagePosRef.current + 1);
      return;
    }
    if (e.key.length === 1) {
      animateLetter(e.key);
      moveCarriage(carriagePosRef.current + 1);
    }
  };

  const wordCount = useMemo(() => text.match(/\S+/g)?.length || 0, [text]);

  const sortedChapters = useMemo(
    () =>
      [...chapters].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [chapters],
  );

  // Per-line rendering. Each line is its own block div so the notes margin
  // can position cards at the line's Y. Empty lines get a non-breaking
  // space so they still take a full line of vertical space (matching the
  // textarea overlay's line height). The blinking typer-caret is rendered
  // at textarea.selectionStart/End so clicks and arrow keys stay truthful.
  const renderedLines = useMemo(() => {
    const caret = (key: string) => (
      <span key={key} className="typer-caret" aria-hidden="true" />
    );

    return parsedLines.map((line, lineIdx) => {
      const lineEnd = line.lineStart + line.text.length;
      const caretInLine = caretIndex >= line.lineStart && caretIndex <= lineEnd;

      if (line.isEmpty) {
        return (
          <div key={lineIdx} data-typer-line={lineIdx}>
            {caretInLine && caret(`caret-${lineIdx}`)}
            <span aria-hidden="true">{" "}</span>
          </div>
        );
      }

      const chars = Array.from(line.text).flatMap((ch, j) => {
        const globalIdx = line.lineStart + j;
        const char = globalIdx === animIndex ? (
          <span key={`a-${animKey}`} className="typer-char">
            {ch}
          </span>
        ) : (
          <span key={`${lineIdx}-${j}`}>{ch}</span>
        );
        return globalIdx === caretIndex
          ? [caret(`caret-${lineIdx}-${j}`), char]
          : [char];
      });

      if (caretInLine && caretIndex === lineEnd) {
        chars.push(caret(`caret-${lineIdx}-end`));
      }

      return (
        <div key={lineIdx} data-typer-line={lineIdx}>
          {chars}
        </div>
      );
    });
  }, [parsedLines, caretIndex, animIndex, animKey]);

  // Editor accepts input when:
  //   - no vault connected (ephemeral typewriter mode, preserves the
  //     original Typer behavior so the app still works pre-vault), OR
  //   - a vault is connected AND a chapter is active.
  // The middle state — vault connected, no active chapter — locks the
  // textarea so the user doesn't write into a void.
  const editorEnabled = !vaultPath || (vaultPath !== null && activeId !== null);

  const renderRow = (row: { y: number; keys: KeyDef[] }) => {
    const totalUnits = row.keys.reduce(
      (sum, k) => sum + (k.kind === "space" ? SPACE_WIDTH_U : 1),
      0,
    );
    const totalWidth = totalUnits * KEY_UNIT;
    let cursorX = (1200 - totalWidth) / 2;

    return row.keys.map((k, idx) => {
      const w = k.kind === "space" ? SPACE_WIDTH_U : 1;
      const cellWidth = w * KEY_UNIT;
      const centerX = cursorX + cellWidth / 2;
      cursorX += cellWidth;

      if (k.kind === "space") {
        return (
          <g key={`${row.y}-${idx}-space`} transform={`translate(${centerX}, ${row.y})`}>
            <g className="typer-space">
              <rect
                x={-cellWidth / 2 + 6}
                y={-20}
                width={cellWidth - 12}
                height={40}
                rx="20"
                fill="white"
                stroke="black"
                strokeWidth="4"
              />
              <rect
                x={-cellWidth / 2 + 12}
                y={-14}
                width={cellWidth - 24}
                height={28}
                rx="14"
                fill="none"
                stroke="black"
                strokeWidth="2"
              />
            </g>
          </g>
        );
      }

      const labelCls =
        k.label.length > 1 && !/^[⇧⇪⇥⏎⌫⌘⌥⌃←↑↓→]$/.test(k.label)
          ? "key-text-small"
          : "key-text";

      return (
        <g key={`${row.y}-${idx}-${k.data}`} transform={`translate(${centerX}, ${row.y})`}>
          <g className="typer-key" data-letter={k.data}>
            <circle cx="0" cy="0" r={KEY_RADIUS} fill="white" stroke="black" strokeWidth="4" />
            <circle cx="0" cy="0" r={KEY_RADIUS - 6} fill="white" stroke="black" strokeWidth="2" />
            <text x="0" y="0" className={labelCls}>
              {k.label}
            </text>
          </g>
        </g>
      );
    });
  };

  const renderedRows = useMemo(() => ROWS.map((row) => renderRow(row)), []);

  const renderModernRow = (row: { y: number; keys: KeyDef[] }, rowIdx: number) => {
    const totalUnits = row.keys.reduce(
      (sum, k) => sum + (k.kind === "space" ? SPACE_WIDTH_U : 1),
      0,
    );
    const modernUnit = 42;
    const totalWidth = totalUnits * modernUnit;
    let cursorX = (1200 - totalWidth) / 2;
    const y = 520 + rowIdx * 54;

    return row.keys.map((k, idx) => {
      const w = k.kind === "space" ? SPACE_WIDTH_U : 1;
      const cellWidth = w * modernUnit;
      const centerX = cursorX + cellWidth / 2;
      cursorX += cellWidth;

      if (k.kind === "space") {
        return (
          <g key={`${y}-${idx}-space`} transform={`translate(${centerX}, ${y})`}>
            <g className="typer-space">
              <rect
                x={-cellWidth / 2 + 6}
                y={-17}
                width={cellWidth - 12}
                height={34}
                rx="10"
                fill="white"
                stroke="black"
                strokeWidth="4"
              />
              <line x1={-cellWidth / 2 + 26} y1="0" x2={cellWidth / 2 - 26} y2="0" stroke="black" strokeWidth="2" />
            </g>
          </g>
        );
      }

      const labelCls =
        k.label.length > 1 && !/^[⇧⇪⇥⏎⌫⌘⌥⌃←↑↓→]$/.test(k.label)
          ? "key-text-small"
          : "key-text";

      return (
        <g key={`${y}-${idx}-${k.data}`} transform={`translate(${centerX}, ${y})`}>
          <g className="typer-key" data-letter={k.data}>
            <rect x="-17" y="-17" width="34" height="34" rx="8" fill="white" stroke="black" strokeWidth="3.5" />
            <rect x="-11" y="-11" width="22" height="22" rx="5" fill="none" stroke="black" strokeWidth="1.5" />
            <text x="0" y="0" className={labelCls}>
              {k.label}
            </text>
          </g>
        </g>
      );
    });
  };

  const renderedModernRows = useMemo(() => ROWS.map((row, idx) => renderModernRow(row, idx)), []);

  const renderModernKeyboardSvg = () => (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 430 1200 390"
      className="typer-svg h-full w-full overflow-visible"
      preserveAspectRatio="xMidYMax meet"
    >
      <rect
        x="170"
        y="448"
        width="860"
        height="360"
        rx="34"
        fill="white"
        stroke="black"
        strokeWidth="6"
      />
      <rect
        x="196"
        y="486"
        width="808"
        height="272"
        rx="8"
        fill="none"
        stroke="black"
        strokeWidth="2"
      />
      <rect x="470" y="462" width="260" height="30" rx="15" fill="white" stroke="black" strokeWidth="3" />
      <line x1="502" y1="477" x2="698" y2="477" stroke="black" strokeWidth="2" strokeDasharray="6 8" />
      {renderedModernRows}
      <rect x="385" y="775" width="430" height="15" rx="7.5" fill="white" stroke="black" strokeWidth="3" />
    </svg>
  );

  const renderQuillSvg = () => (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 120 1200 560"
      className="typer-svg h-full w-full overflow-visible"
      preserveAspectRatio="xMidYMax meet"
    >
      <path d="M 110 635 L 1090 635" fill="none" stroke="black" strokeWidth="6" />
      <path d="M 190 570 Q 420 525 710 545 Q 830 555 990 530" fill="none" stroke="black" strokeWidth="2" strokeDasharray="8 10" />
      <g transform="translate(828, 420)">
        <ellipse cx="86" cy="170" rx="92" ry="17" fill="white" stroke="black" strokeWidth="3" />
        <path
          d="M 34 62 L 50 36 Q 86 22 122 36 L 138 62 L 126 158 Q 86 178 46 158 Z"
          fill="white"
          stroke="black"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M 48 67 H 124" fill="none" stroke="black" strokeWidth="2" />
        <path d="M 54 80 H 118 M 58 94 H 114" fill="none" stroke="black" strokeWidth="1.5" />
        <g
          key={`quill-ink-${quillMotion.kind}-${quillMotion.tick}`}
          className={[
            "quill-ink",
            quillMotion.kind === "dip" ? "quill-ink-dip" : "",
          ].join(" ")}
          opacity="0.72"
        >
          <rect x="54" y="108" width="64" height="28" rx="4" fill="black" />
          <path d="M 62 114 H 110 M 62 124 H 100" fill="none" stroke="white" strokeWidth="2" />
        </g>
        <rect x="56" y="18" width="60" height="24" rx="4" fill="white" stroke="black" strokeWidth="4" />
        <rect x="68" y="6" width="36" height="18" rx="3" fill="white" stroke="black" strokeWidth="3" />
      </g>
      <g
        key={`quill-pen-${quillMotion.kind}-${quillMotion.tick}`}
        className={[
          "quill-pen",
          quillMotion.kind === "stroke" ? "quill-pen-stroke" : "",
          quillMotion.kind === "dip" ? "quill-pen-dip" : "",
        ].join(" ")}
        transform="translate(0, 0)"
      >
        <g transform="translate(72, 68) scale(0.82)">
          <path
            d="M 268 466 C 360 296 514 186 718 138 C 642 258 508 392 354 508 Z"
            fill="white"
            stroke="black"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M 316 454 C 424 326 560 220 690 158"
            fill="none"
            stroke="black"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 360 414 L 470 444 M 402 368 L 526 400 M 450 322 L 590 352 M 504 272 L 644 296 M 560 224 L 676 242"
            fill="none"
            stroke="black"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M 354 508 L 246 596" fill="none" stroke="black" strokeWidth="9" strokeLinecap="round" />
          <path d="M 248 596 L 224 624" fill="none" stroke="black" strokeWidth="4" strokeLinecap="round" />
          <path d="M 216 626 Q 224 615 232 626 Q 224 636 216 626 Z" fill="black" />
        </g>
      </g>
      <path d="M 216 632 Q 320 608 470 620 Q 650 636 790 602" fill="none" stroke="black" strokeWidth="2" />
    </svg>
  );

  // -------- Sidebar (chapter list) --------
  const renderSidebar = () => (
    <aside className="w-60 shrink-0 border-r border-black dark:border-white flex flex-col bg-white dark:bg-black">
      <div className="p-3 bg-black text-white dark:bg-white dark:text-black font-mono uppercase text-xs tracking-widest flex items-center gap-2 shrink-0">
        <BookText size={14} /> Chapters
      </div>

      {!vaultPath ? (
        <div className="p-4 font-mono text-xs leading-relaxed opacity-60">
          Connect a vault in <span className="font-bold">Archiver</span> to start
          a manuscript. Drafts are saved as <code>.md</code> files inside the
          vault’s <code>Drafts/</code> folder.
        </div>
      ) : (
        <>
          <div className="grow overflow-y-auto">
            {sortedChapters.length === 0 ? (
              <div className="p-4 font-mono text-xs leading-relaxed opacity-60">
                No chapters yet. Click <span className="font-bold">+ New Chapter</span>{" "}
                below to write your first one.
              </div>
            ) : (
              <ul>
                {sortedChapters.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => handlePickChapter(c.id)}
                        className={`w-full text-left px-3 py-2 border-b border-black/20 dark:border-white/20 transition-colors ${
                          isActive
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                        }`}
                      >
                        <div className="font-mono text-sm truncate font-bold">
                          {c.title}
                          {isActive && dirty && (
                            <span className="ml-1 opacity-70">•</span>
                          )}
                        </div>
                        <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60 mt-0.5 flex justify-between gap-2">
                          <span>{c.wordCount}w</span>
                          <span>{formatRelative(c.updatedAt)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* New-chapter footer. Toggles between a button and an inline
              input so we never overlay a modal — typewriter aesthetic. */}
          <div className="border-t border-black dark:border-white shrink-0">
            {newChapterTitle === null ? (
              <button
                onClick={beginNewChapter}
                className="w-full p-3 font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
              >
                <Plus size={14} /> New Chapter
              </button>
            ) : (
              <div className="p-2 flex flex-col gap-2">
                <input
                  ref={newTitleInputRef}
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void confirmNewChapter();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelNewChapter();
                    }
                  }}
                  placeholder="Chapter title…"
                  className="w-full px-2 py-1.5 border border-black dark:border-white bg-white text-black dark:bg-black dark:text-white font-mono text-sm focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void confirmNewChapter()}
                    className="flex-1 px-2 py-1 border border-black dark:border-white font-mono text-[0.65rem] uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={cancelNewChapter}
                    className="px-2 py-1 border border-black dark:border-white font-mono text-[0.65rem] uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );

  // -------- Header (above paper) showing active chapter + save state --------
  const renderHeader = () => {
    const title = activeChapter?.title
      ?? (vaultPath ? "No chapter open" : "Draft _");
    return (
      <div className="flex justify-between items-end mb-4 border-b-4 border-black dark:border-white pb-2 shrink-0 gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono uppercase font-bold tracking-widest text-xl truncate">
            {title}
          </span>
          {activeChapter && dirty && (
            <span
              className="font-mono text-[0.65rem] uppercase tracking-widest opacity-70"
              title="Unsaved changes"
            >
              · unsaved
            </span>
          )}
          {activeChapter && !dirty && !saving && (
            <span className="font-mono text-[0.65rem] uppercase tracking-widest opacity-50 inline-flex items-center gap-1">
              <Check size={11} /> saved
            </span>
          )}
          {saving && (
            <span className="font-mono text-[0.65rem] uppercase tracking-widest opacity-70">
              · saving…
            </span>
          )}
          {saveError && (
            <span
              className="font-mono text-[0.65rem] uppercase tracking-widest inline-flex items-center gap-1"
              title={saveError}
            >
              <AlertCircle size={11} /> save failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-sm">Words: {wordCount}</span>
          {activeChapter && (
            <button
              onClick={handleManualSave}
              disabled={saving || !dirty}
              title="Save (⌘S)"
              className="px-3 py-1 border border-black dark:border-white font-mono text-[0.65rem] uppercase tracking-widest inline-flex items-center gap-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={11} /> Save
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grow flex bg-white dark:bg-black overflow-hidden relative">
      {renderSidebar()}

      <div className="grow flex flex-col min-w-0 overflow-hidden">
        {/* Paper column — takes all space above the typewriter and scrolls
            internally as the draft grows. The typewriter SVG below has its
            own fixed-height region so the two never overlap. */}
        <div className="flex-1 min-h-0 flex justify-center px-4 sm:px-6 pt-6">
          <div className="w-full max-w-6xl flex flex-col min-h-0">
            {renderHeader()}

            <div
              ref={paperRef}
              className="typer-paper-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-6 px-1"
            >
              <div
                ref={linesContainerRef}
                className="typer-paper-frame relative min-h-full w-full font-mono text-lg leading-relaxed text-black dark:text-white"
                onMouseMove={vaultPath ? handlePaperMouseMove : undefined}
                onMouseLeave={vaultPath ? handlePaperMouseLeave : undefined}
              >
                {/* Paper text column. When notes are available, right padding
                    reserves an in-page annotation lane instead of widening
                    the whole editor row. */}
                <div
                  className={[
                    "typer-paper-editor relative min-h-full box-border whitespace-pre-wrap break-words cursor-text",
                    vaultPath ? "pr-[10.5rem] md:pr-[15rem]" : "",
                  ].join(" ")}
                  onClick={() => editorEnabled && captureRef.current?.focus()}
                >
                  {text.length === 0 ? (
                    <span className="text-black/30 dark:text-white/30">
                      {editorEnabled
                        ? "Start typing..."
                        : "Pick a chapter or create a new one to start writing."}
                    </span>
                  ) : (
                    renderedLines
                  )}

                  <textarea
                    ref={captureRef}
                    value={text}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onKeyUp={syncCaretFromCapture}
                    onClick={syncCaretAfterEvent}
                    onFocus={syncCaretAfterEvent}
                    onMouseUp={syncCaretAfterEvent}
                    onSelect={syncCaretAfterEvent}
                    onCompositionEnd={handleCompositionEnd}
                    disabled={!editorEnabled}
                    className="typer-capture font-mono text-lg leading-relaxed whitespace-pre-wrap break-words"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>

                {/* Notes rail — lives inside the paper so annotations don't
                    create a second horizontal column outside the draft. */}
                {vaultPath && (
                  <aside className="typer-note-rail absolute top-0 right-0 bottom-0 w-[9.25rem] md:w-[13rem] pointer-events-none">
                    {/* Floating "+ Note" — display:none by default, shown by
                        the layout effect at the hovered line's Y. */}
                    <button
                      ref={plusBtnRef}
                      type="button"
                      onClick={() =>
                        hoveredLineIdx !== null && beginNewNote(hoveredLineIdx)
                      }
                      style={{ display: "none", top: 0 }}
                      className="typer-add-note absolute right-0 pointer-events-auto font-mono text-[0.58rem] uppercase tracking-widest inline-flex items-center gap-1 px-2 py-1.5 transition-colors"
                      title="Add a note here"
                    >
                      <MessageSquarePlus size={11} /> Note
                    </button>

                    {/* Anchored notes — each card sets its own ref into the
                        registry so the layout effect can position it. */}
                    {anchoredNotes.map(({ note }) => (
                      <NoteCardView
                        key={note.id}
                        note={note}
                        isEditing={editingNoteId === note.id}
                        draft={editingDraft}
                        onChangeDraft={setEditingDraft}
                        onBeginEdit={() => beginEditNote(note)}
                        onCancel={cancelEditNote}
                        onCommit={commitNote}
                        onDelete={() => deleteNote(note.id)}
                        refCallback={(el) => {
                          if (el) noteCardRefsRef.current.set(note.id, el);
                          else noteCardRefsRef.current.delete(note.id);
                        }}
                      />
                    ))}

                    {/* Inline editor for a brand-new note. Reuses the same
                        positioning trick — attach a ref keyed to the
                        sentinel id so the layout effect places it correctly. */}
                    {editingNoteId !== null &&
                      editingNoteId.startsWith("new:") && (
                        <NewNoteEditor
                          draft={editingDraft}
                          onChangeDraft={setEditingDraft}
                          onCancel={cancelEditNote}
                          onCommit={commitNote}
                          refCallback={(el) => {
                            if (el) noteCardRefsRef.current.set(editingNoteId, el);
                            else noteCardRefsRef.current.delete(editingNoteId);
                          }}
                        />
                      )}
                  </aside>
                )}
              </div>

              {/* Orphan notes — paragraph was deleted or heavily edited.
                  Surfaced explicitly so the writer can rescue or discard
                  the note rather than losing it silently. */}
              {vaultPath && orphanNotes.length > 0 && (
                <div className="max-w-3xl mx-auto mt-8 border-t border-black dark:border-white pt-4">
                  <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60 mb-2 flex items-center gap-2">
                    <StickyNote size={11} /> Orphan notes — original paragraph is gone
                  </div>
                  <div className="flex flex-col gap-2">
                    {orphanNotes.map((n) => (
                      <div
                        key={n.id}
                        className="border border-dashed border-black dark:border-white p-3 font-mono text-xs"
                      >
                        <div className="opacity-60 italic text-[0.55rem] mb-1 truncate">
                          ↳ was near: {n.anchorSnippet || "(empty line)"}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{n.body}</div>
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => deleteNote(n.id)}
                            className="font-mono text-[0.55rem] uppercase tracking-widest inline-flex items-center gap-1 px-2 py-1 border border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                          >
                            <Trash2 size={10} /> Discard
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Typewriter SVG — pinned to the bottom of the app. The paper area
            above scrolls independently, so the SVG never covers text. */}
        <div className="typer-machine-stage w-full flex justify-center items-end opacity-95 pointer-events-none shrink-0">
          {instrument === "typewriter" ? (
            <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 210 1200 720"
            className="typer-svg h-full w-full overflow-visible"
            preserveAspectRatio="xMidYMax meet"
          >
            {/* Rear chassis (Straight orthogonal curves) */}
            <path
              d="M 160 380 C 160 320, 230 290, 400 290 L 800 290 C 970 290, 1040 320, 1040 380 L 1040 510 L 160 510 Z"
              fill="white"
              stroke="black"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <path
              d="M 175 380 C 175 330, 240 305, 400 305 L 800 305 C 960 305, 1025 330, 1025 380 L 1025 510 L 175 510 Z"
              fill="none"
              stroke="black"
              strokeWidth="2"
            />

            {/* Moving carriage assembly */}
            <g className="typer-carriage">
              <rect x="300" y="275" width="600" height="20" rx="10" fill="white" stroke="black" strokeWidth="4" />
              <line x1="310" y1="285" x2="890" y2="285" stroke="black" strokeWidth="2" />
              <rect x="290" y="240" width="620" height="55" rx="4" fill="white" stroke="black" strokeWidth="5" />
              <line x1="290" y1="250" x2="910" y2="250" stroke="black" strokeWidth="1.5" />
              <line x1="290" y1="285" x2="910" y2="285" stroke="black" strokeWidth="1.5" />
              <rect x="270" y="245" width="20" height="45" rx="3" fill="white" stroke="black" strokeWidth="4" />
              <circle cx="250" cy="267" r="32" fill="white" stroke="black" strokeWidth="4" />
              <circle cx="250" cy="267" r="26" fill="none" stroke="black" strokeWidth="2" strokeDasharray="3 4" />
              <circle cx="250" cy="267" r="18" fill="white" stroke="black" strokeWidth="3" />
              <circle cx="250" cy="267" r="6" fill="black" />
              <rect x="910" y="245" width="20" height="45" rx="3" fill="white" stroke="black" strokeWidth="4" />
              <circle cx="950" cy="267" r="32" fill="white" stroke="black" strokeWidth="4" />
              <circle cx="950" cy="267" r="26" fill="none" stroke="black" strokeWidth="2" strokeDasharray="3 4" />
              <circle cx="950" cy="267" r="18" fill="white" stroke="black" strokeWidth="3" />
              <circle cx="950" cy="267" r="6" fill="black" />
              <rect x="310" y="225" width="580" height="12" rx="6" fill="white" stroke="black" strokeWidth="4" />
              <line x1="330" y1="231" x2="870" y2="231" stroke="black" strokeWidth="3" strokeDasharray="6 8" />
              <rect x="420" y="215" width="24" height="32" rx="4" fill="white" stroke="black" strokeWidth="4" />
              <rect x="425" y="215" width="14" height="32" fill="none" stroke="black" strokeWidth="2" />
              <rect x="756" y="215" width="24" height="32" rx="4" fill="white" stroke="black" strokeWidth="4" />
              <rect x="761" y="215" width="14" height="32" fill="none" stroke="black" strokeWidth="2" />
            </g>

            {/* Carriage return lever */}
            <g className="typer-lever">
              <path
                d="M 270 260 Q 110 250 110 310 Q 110 340 130 340 Q 150 340 135 310 Q 120 280 270 285 Z"
                fill="white"
                stroke="black"
                strokeWidth="5"
                strokeLinejoin="round"
              />
              <path
                d="M 270 266 Q 125 258 125 310 Q 125 325 135 325 Q 140 325 130 310 Q 125 285 270 279 Z"
                fill="none"
                stroke="black"
                strokeWidth="1.5"
              />
            </g>

            {/* Ribbon spools */}
            <g transform="translate(360, 420)">
              <circle cx="0" cy="0" r="55" fill="white" stroke="black" strokeWidth="5" />
              <circle cx="0" cy="0" r="48" fill="none" stroke="black" strokeWidth="2" />
              <path
                d="M 0 -55 L 0 55 M -55 0 L 55 0 M -39 -39 L 39 39 M -39 39 L 39 -39"
                stroke="black"
                strokeWidth="4"
              />
              <circle cx="0" cy="0" r="20" fill="white" stroke="black" strokeWidth="4" />
              <circle cx="0" cy="0" r="6" fill="black" />
            </g>
            <g transform="translate(840, 420)">
              <circle cx="0" cy="0" r="55" fill="white" stroke="black" strokeWidth="5" />
              <circle cx="0" cy="0" r="48" fill="none" stroke="black" strokeWidth="2" />
              <path
                d="M 0 -55 L 0 55 M -55 0 L 55 0 M -39 -39 L 39 39 M -39 39 L 39 -39"
                stroke="black"
                strokeWidth="4"
              />
              <circle cx="0" cy="0" r="20" fill="white" stroke="black" strokeWidth="4" />
              <circle cx="0" cy="0" r="6" fill="black" />
            </g>

            {/* Ribbon tape */}
            <path
              d="M 360 420 Q 480 350 585 260 L 615 260 Q 720 350 840 420"
              fill="none"
              stroke="black"
              strokeWidth="8"
            />

            {/* Ribbon & strike guide */}
            <path
              d="M 585 270 L 585 240 L 575 220 L 585 220 L 595 240 L 605 240 L 615 220 L 625 220 L 615 240 L 615 270 Z"
              fill="white"
              stroke="black"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path
              d="M 592 245 L 608 245 M 592 255 L 608 255 M 600 245 L 600 270"
              fill="none"
              stroke="black"
              strokeWidth="2"
            />

            {/* Main front chassis (Now purely orthogonal / flat rectangle) */}
            <rect
              x="120"
              y="510"
              width="960"
              height="380"
              rx="8"
              fill="white"
              stroke="black"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <rect
              x="135"
              y="522"
              width="930"
              height="356"
              rx="4"
              fill="none"
              stroke="black"
              strokeWidth="2"
            />

            {/* Keyboard deck (Remains perfectly horizontal/orthogonal as before) */}
            <rect
              x="165"
              y="525"
              width="870"
              height="345"
              rx="14"
              fill="white"
              stroke="black"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <rect
              x="178"
              y="536"
              width="844"
              height="323"
              rx="10"
              fill="none"
              stroke="black"
              strokeWidth="2"
            />

            {/* Typebars (basket) */}
            <path
              d="M 370 510 C 370 560, 830 560, 830 510"
              fill="none"
              stroke="black"
              strokeWidth="6"
            />
            <g fill="none" stroke="black" strokeWidth="2">
              <path d="M 390 510 Q 500 400 595 270" />
              <path d="M 420 520 Q 510 405 596 270" />
              <path d="M 450 527 Q 520 410 597 270" />
              <path d="M 480 532 Q 530 415 598 270" />
              <path d="M 510 535 Q 545 420 599 270" />
              <path d="M 540 537 Q 565 425 600 270" />
              <path d="M 570 538 Q 585 430 600 270" />
              <path d="M 600 539 Q 600 430 600 270" />
              <path d="M 630 538 Q 615 430 600 270" />
              <path d="M 660 537 Q 635 425 600 270" />
              <path d="M 690 535 Q 655 420 601 270" />
              <path d="M 720 532 Q 670 415 602 270" />
              <path d="M 750 527 Q 680 410 603 270" />
              <path d="M 780 520 Q 690 405 604 270" />
              <path d="M 810 510 Q 700 400 605 270" />
            </g>

            {/* Keyboard rows */}
            {renderedRows}

            {/* Front lip (Now perfectly orthogonal as well) */}
            <rect
              x="120"
              y="890"
              width="960"
              height="35"
              rx="4"
              fill="white"
              stroke="black"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <rect
              x="135"
              y="898"
              width="930"
              height="19"
              rx="2"
              fill="none"
              stroke="black"
              strokeWidth="2"
            />

            {/* Brand decal */}
            <text x="600" y="475" className="brand-text">
              CORONA
            </text>
            </svg>
          ) : instrument === "keyboard" ? (
            renderModernKeyboardSvg()
          ) : (
            renderQuillSvg()
          )}
        </div>
      </div>

      <div className="typer-instrument-switch absolute right-4 bottom-4 z-20 flex items-center border border-black dark:border-white bg-white/95 dark:bg-black/95 shadow-[3px_3px_0_currentColor]">
        {WRITING_INSTRUMENTS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setInstrument(id)}
            title={label}
            aria-label={label}
            aria-pressed={instrument === id}
            className={[
              "p-2 border-l first:border-l-0 border-black dark:border-white transition-colors",
              instrument === id
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black",
            ].join(" ")}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components used inside the notes margin. Defined here rather than in
// their own files because they're tightly coupled to Typer's note state
// and would have nothing useful to say in isolation.
// ---------------------------------------------------------------------------

type NoteCardViewProps = {
  note: ChapterNote;
  isEditing: boolean;
  draft: string;
  onChangeDraft: (s: string) => void;
  onBeginEdit: () => void;
  onCancel: () => void;
  onCommit: () => void;
  onDelete: () => void;
  refCallback: (el: HTMLDivElement | null) => void;
};

function NoteCardView({
  note,
  isEditing,
  draft,
  onChangeDraft,
  onBeginEdit,
  onCancel,
  onCommit,
  onDelete,
  refCallback,
}: NoteCardViewProps) {
  // Position is set by the parent's layout effect via the ref. We keep
  // the card itself absolutely positioned + width-locked; the top value
  // arrives in the inline style applied after mount.
  return (
    <div
      ref={refCallback}
      className="typer-note-card absolute right-0 w-[8.75rem] md:w-[12.5rem] pointer-events-auto"
      style={{ top: 0 }}
    >
      {isEditing ? (
        <NoteEditorBody
          draft={draft}
          onChangeDraft={onChangeDraft}
          onCancel={onCancel}
          onCommit={onCommit}
        />
      ) : (
        <div className="p-2.5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onBeginEdit}
            className="text-left font-mono text-[0.68rem] leading-snug whitespace-pre-wrap break-words"
            title="Click to edit"
          >
            {note.body}
          </button>
          <div className="flex items-center justify-between gap-2 border-t border-black/20 dark:border-white/20 pt-2">
            <span className="inline-flex items-center gap-1 font-mono text-[0.5rem] uppercase tracking-widest opacity-50">
              <StickyNote size={8} /> {formatRelative(note.updatedAt)}
            </span>
            <div className="flex justify-end gap-1">
              <button
                onClick={onBeginEdit}
                className="font-mono text-[0.5rem] uppercase tracking-widest px-1.5 py-0.5 border border-black/55 dark:border-white/55 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                title="Edit"
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                className="font-mono text-[0.5rem] uppercase tracking-widest px-1.5 py-0.5 border border-black/55 dark:border-white/55 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors inline-flex items-center gap-1"
                title="Delete"
              >
                <Trash2 size={9} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type NewNoteEditorProps = {
  draft: string;
  onChangeDraft: (s: string) => void;
  onCancel: () => void;
  onCommit: () => void;
  refCallback: (el: HTMLDivElement | null) => void;
};

function NewNoteEditor({
  draft,
  onChangeDraft,
  onCancel,
  onCommit,
  refCallback,
}: NewNoteEditorProps) {
  return (
    <div
      ref={refCallback}
      className="typer-note-card typer-note-card-editor absolute right-0 w-[8.75rem] md:w-[12.5rem] pointer-events-auto"
      style={{ top: 0 }}
    >
      <NoteEditorBody
        draft={draft}
        onChangeDraft={onChangeDraft}
        onCancel={onCancel}
        onCommit={onCommit}
      />
    </div>
  );
}

type NoteEditorBodyProps = {
  draft: string;
  onChangeDraft: (s: string) => void;
  onCancel: () => void;
  onCommit: () => void;
};

function NoteEditorBody({
  draft,
  onChangeDraft,
  onCancel,
  onCommit,
}: NoteEditorBodyProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Auto-focus + auto-select-existing-body so the writer can immediately
  // either type a new note or hit ⌘A-ish to replace existing content.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    const end = ta.value.length;
    ta.setSelectionRange(end, end);
  }, []);
  return (
    <div className="p-2.5 flex flex-col gap-2">
      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => onChangeDraft(e.target.value)}
        onKeyDown={(e) => {
          // ⌘/Ctrl+Enter saves, Esc cancels. Plain Enter inserts a newline
          // since notes can be multi-line scratch thoughts.
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onCommit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={3}
        placeholder="Note for this line… (⌘↩ save, Esc cancel)"
        className="typer-note-input w-full font-mono text-[0.66rem] leading-snug p-2 border bg-transparent text-black dark:text-white focus:outline-none resize-none"
      />
      <div className="flex justify-end gap-1">
        <button
          onClick={onCommit}
          className="font-mono text-[0.5rem] uppercase tracking-widest px-1.5 py-0.5 border border-black/55 dark:border-white/55 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors inline-flex items-center gap-1"
        >
          <Check size={9} /> Save
        </button>
        <button
          onClick={onCancel}
          className="font-mono text-[0.5rem] uppercase tracking-widest px-1.5 py-0.5 border border-black/55 dark:border-white/55 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors inline-flex items-center gap-1"
        >
          <X size={9} /> Cancel
        </button>
      </div>
    </div>
  );
}
