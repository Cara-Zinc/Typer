// usePetBehavior.ts — Shared blink / gaze / sleep state hook.
//
// Pet renderers receive these values and decide how to draw. The pet shell
// (PetSprite.tsx) wires the hook; renderers don't need to know about timers.
//
// Behavior contract (matches the prototype):
//   - Blink: random 2.5–6s cadence, ~140ms closed.
//   - Gaze: normalized -1..1 from cursor relative to host center.
//   - Sleep: idleTimeout ms with no mousemove / keydown → mood overrides to
//     'sleep' upstream. Default 30s.
//
// All listeners are window-level; `hostRef` only used for gaze geometry.

import { useEffect, useRef, useState, type RefObject } from "react";

export type Gaze = { x: number; y: number };

type Options = {
  idleTimeout?: number; // ms
  follow?: boolean;
  hostRef?: RefObject<HTMLElement | null>;
};

export type PetBehavior = {
  blink: boolean;
  gaze: Gaze;
  sleeping: boolean;
};

export function usePetBehavior({
  idleTimeout = 30_000,
  follow = true,
  hostRef,
}: Options = {}): PetBehavior {
  const [blink, setBlink] = useState(false);
  const [gaze, setGaze] = useState<Gaze>({ x: 0, y: 0 });
  const [sleeping, setSleeping] = useState(false);
  const lastActivity = useRef<number>(Date.now());

  // Random-cadence blink loop.
  useEffect(() => {
    let t: number;
    function tick() {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
      t = window.setTimeout(tick, 2500 + Math.random() * 3500);
    }
    t = window.setTimeout(tick, 1500);
    return () => window.clearTimeout(t);
  }, []);

  // Idle detector.
  useEffect(() => {
    const i = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      setSleeping(idle > idleTimeout);
    }, 1000);
    return () => window.clearInterval(i);
  }, [idleTimeout]);

  // Cursor-follow + activity tracker. Global mousemove/keydown — see
  // README TODO re: only firing when Home tab is active.
  useEffect(() => {
    if (!follow) return;
    function onMove(e: MouseEvent) {
      lastActivity.current = Date.now();
      const host = hostRef?.current;
      if (!host) return;
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / Math.max(120, r.width);
      const dy = (e.clientY - cy) / Math.max(120, r.height);
      setGaze({
        x: Math.max(-1, Math.min(1, dx)),
        y: Math.max(-1, Math.min(1, dy)),
      });
    }
    function onKey() {
      lastActivity.current = Date.now();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [follow, hostRef]);

  return { blink, gaze, sleeping };
}
