## 2026-05-25 - React Component Re-render Avoidance via useMemo on large static SVGs
**Learning:** `useMemo` can be used to wrap a heavy block of JSX to avoid it being diffed by React on every state change. For example, rendering hundreds of static SVG paths via `map` inside a component whose state changes on every keystroke (`text` state) was causing massive re-renders.
**Action:** Use `useMemo` around large arrays of static elements to skip `createElement` and React diffing, significantly improving responsiveness of text inputs.
## 2024-06-10 - Batch File I/O Writes
 **Learning:** In frontend contexts interacting with filesystem storage layers, performing reads/writes sequentially in a loop leads to severe N+1 latency penalties, specially when simulated via Tauri's File System API (`@tauri-apps/plugin-fs`). Our benchmark showed 3 sequential writes taking ~100ms vs ~5ms for a batched write - a 95% performance improvement.
 **Action:** For inventory or state updates, pass a quantity to the update function to batch the state change in memory before performing a single final write to the file system.
