import { useEffect, useState } from "react";

/**
 * Tracks how long the user has been continuously reading.
 * - Ticks once per second.
 * - Pauses while the OS window/tab is hidden.
 * - Resets to zero when `resetKey` changes (e.g. when the user opens a new file).
 *
 * The intent is a gentle eye-strain reminder, not strict idle detection.
 */
export function useReadingTimer(resetKey: unknown): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
  }, [resetKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return seconds;
}

export function formatReadingTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
