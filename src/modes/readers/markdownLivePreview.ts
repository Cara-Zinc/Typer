// CodeMirror 6 "live preview" for Markdown — Obsidian-style.
//
// The whole document stays a single editor. Inline/block formatting is styled
// in place (bold, italic, strikethrough, inline code, highlight, headings,
// bullets) and the raw syntax markers are hidden — EXCEPT on the line(s) the
// cursor/selection touches, where the markers are revealed so you can edit
// them. Editing one line therefore only affects that line's markers; every
// other paragraph keeps its rendered appearance.

import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { Extension, Range } from "@codemirror/state";
import { commonmarkLanguage, markdown } from "@codemirror/lang-markdown";
import { GFM, type InlineContext, type MarkdownConfig } from "@lezer/markdown";

// --- `==highlight==` inline grammar (mirrors @lezer/markdown's Strikethrough).
const HighlightDelim = { resolve: "Highlight", mark: "HighlightMark" };

const Highlight: MarkdownConfig = {
  defineNodes: [{ name: "Highlight" }, { name: "HighlightMark" }],
  parseInline: [
    {
      name: "Highlight",
      parse(cx: InlineContext, next: number, pos: number) {
        // `=` is char code 61; require a doubled `==`.
        if (next !== 61 || cx.char(pos + 1) !== 61) return -1;
        return cx.addDelimiter(HighlightDelim, pos, pos + 2, true, true);
      },
      after: "Emphasis",
    },
  ],
};

// Lezer node name -> CSS class applied to the rendered span (always on, even
// while editing, so formatting never "flickers" off when the cursor enters).
const STYLE_CLASS: Record<string, string> = {
  StrongEmphasis: "cm-md-strong",
  Emphasis: "cm-md-em",
  InlineCode: "cm-md-code",
  Strikethrough: "cm-md-strike",
  Highlight: "cm-md-highlight",
  ATXHeading1: "cm-md-h1",
  ATXHeading2: "cm-md-h2",
  ATXHeading3: "cm-md-h3",
  ATXHeading4: "cm-md-h4",
  ATXHeading5: "cm-md-h5",
  ATXHeading6: "cm-md-h6",
};

// Inline marker nodes whose characters are hidden on inactive lines.
const INLINE_MARK = new Set([
  "EmphasisMark",
  "CodeMark",
  "StrikethroughMark",
  "HighlightMark",
]);

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.textContent = "•";
    span.className = "cm-md-bullet";
    return span;
  }
  eq() {
    return true;
  }
}
const bulletWidget = new BulletWidget();

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const doc = state.doc;

  // Lines touched by any selection range get their raw markers revealed.
  const activeLines = new Set<number>();
  for (const r of state.selection.ranges) {
    const first = doc.lineAt(r.from).number;
    const last = doc.lineAt(r.to).number;
    for (let n = first; n <= last; n += 1) activeLines.add(n);
  }
  const lineActive = (pos: number) => activeLines.has(doc.lineAt(pos).number);

  const deco: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;

        const style = STYLE_CLASS[name];
        if (style && node.to > node.from) {
          deco.push(Decoration.mark({ class: style }).range(node.from, node.to));
        }

        if (name === "HeaderMark") {
          if (lineActive(node.from)) return;
          const line = doc.lineAt(node.from);
          const leading = doc.sliceString(line.from, node.from).trim() === "";
          if (!leading) {
            // Closing ATX mark (e.g. `# Title #`) — just hide the run.
            deco.push(Decoration.replace({}).range(node.from, node.to));
            return;
          }
          // Opening mark: also swallow the spaces between `#` and the text.
          let end = node.to;
          while (end < line.to && doc.sliceString(end, end + 1) === " ") end += 1;
          deco.push(Decoration.replace({}).range(node.from, end));
          return;
        }

        if (INLINE_MARK.has(name)) {
          // Don't hide fenced-code fences — only inline-code backticks.
          if (name === "CodeMark" && node.node.parent?.name !== "InlineCode") return;
          if (lineActive(node.from)) return;
          deco.push(Decoration.replace({}).range(node.from, node.to));
          return;
        }

        if (name === "ListMark") {
          const marker = doc.sliceString(node.from, node.to);
          if (/^[-*+]$/.test(marker) && !lineActive(node.from)) {
            deco.push(Decoration.replace({ widget: bulletWidget }).range(node.from, node.to));
          }
          return;
        }
      },
    });
  }

  return Decoration.set(deco, true);
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

// Transparent, height-auto theme so the editor flows inside the reader's own
// scroll container and inherits its serif/mono fonts and fg/bg colors.
const liveBaseTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "inherit", height: "auto" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    overflow: "visible",
    fontFamily: "var(--font-serif, serif)",
    lineHeight: "1.7",
  },
  ".cm-content": { padding: "0", caretColor: "currentColor" },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "currentColor" },
  ".cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, currentColor 22%, transparent)",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, currentColor 24%, transparent)",
  },
});

export function markdownLivePreview(): Extension {
  return [
    markdown({ base: commonmarkLanguage, extensions: [GFM, Highlight] }),
    EditorView.lineWrapping,
    livePreviewPlugin,
    liveBaseTheme,
  ];
}
