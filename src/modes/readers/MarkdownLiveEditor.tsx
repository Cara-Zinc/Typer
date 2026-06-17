import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdownLivePreview } from "./markdownLivePreview";

export type MarkdownLiveEditorHandle = {
  wrapSelection: (before: string, after: string, placeholder: string) => void;
  insertTask: () => void;
  toggleComment: () => void;
  focus: () => void;
};

type Props = {
  value: string;
  onChange: (next: string) => void;
};

function commentBody(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("%%") || !trimmed.endsWith("%%") || trimmed.length < 4) return null;
  return trimmed.slice(2, -2).trim();
}

// Toggle the current line between plain text and an Obsidian `%% comment %%`.
function applyToggleComment(view: EditorView): boolean {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const indent = line.text.match(/^\s*/)?.[0] ?? "";
  const body = commentBody(line.text);
  const next =
    body === null
      ? `${indent}%% ${line.text.slice(indent.length).trim() || "comment"} %%`
      : `${indent}${body}`;
  view.dispatch({ changes: { from: line.from, to: line.to, insert: next }, userEvent: "input" });
  return true;
}

export const MarkdownLiveEditor = forwardRef<MarkdownLiveEditorHandle, Props>(
  function MarkdownLiveEditor({ value, onChange }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    // Keep the latest onChange without re-creating the editor each render.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      const view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: value,
          extensions: [
            history(),
            keymap.of([
              { key: "Mod-/", run: applyToggleComment },
              ...defaultKeymap,
              ...historyKeymap,
            ]),
            markdownLivePreview(),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            }),
          ],
        }),
      });
      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // Editor is created once; external value changes are synced below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync external value changes (e.g. switching files) into the editor
    // without clobbering the cursor while the user is typing.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (value !== current) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
      }
    }, [value]);

    useImperativeHandle(ref, () => ({
      wrapSelection(before, after, placeholder) {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        const selected = view.state.sliceDoc(from, to) || placeholder;
        view.dispatch({
          changes: { from, to, insert: `${before}${selected}${after}` },
          selection: { anchor: from + before.length, head: from + before.length + selected.length },
          userEvent: "input",
        });
        view.focus();
      },
      insertTask() {
        const view = viewRef.current;
        if (!view) return;
        const { from } = view.state.selection.main;
        const line = view.state.doc.lineAt(from);
        const insert = `${line.length > 0 ? "\n" : ""}- [ ] task`;
        const pos = line.to;
        const taskFrom = pos + insert.length - "task".length;
        view.dispatch({
          changes: { from: pos, insert },
          selection: { anchor: taskFrom, head: taskFrom + "task".length },
          userEvent: "input",
        });
        view.focus();
      },
      toggleComment() {
        const view = viewRef.current;
        if (!view) return;
        applyToggleComment(view);
        view.focus();
      },
      focus() {
        viewRef.current?.focus();
      },
    }));

    return <div ref={hostRef} className="cm-md-live" />;
  },
);
