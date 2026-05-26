## 2026-05-25 - React Component Re-render Avoidance via useMemo on large static SVGs
**Learning:** `useMemo` can be used to wrap a heavy block of JSX to avoid it being diffed by React on every state change. For example, rendering hundreds of static SVG paths via `map` inside a component whose state changes on every keystroke (`text` state) was causing massive re-renders.
**Action:** Use `useMemo` around large arrays of static elements to skip `createElement` and React diffing, significantly improving responsiveness of text inputs.
