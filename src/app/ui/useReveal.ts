'use client';

import React from 'react';
import { readDuration, readEasing } from './motion';

// How long past the tween's end (ms) it's finished anyway, if frames have stopped (a hidden
// tab, or a browser that isn't painting)
const FINISH_GRACE = 200;

// How far something is shown, from 0 (gone) to 1 (all there), easing toward 1 while `on` and
// 0 while not, on --ease-slide over --duration-move, a frame at a time, for what can't be a
// CSS transition (the card tray, drawn in Konva, and the stage around it). A new `key` (another
// board) snaps to the end instead, as does reduced motion. `finish` jumps to the end now
// (before an export).
export function useReveal(on: boolean, key: unknown) {
  const target = on ? 1 : 0;
  const [value, setValue] = React.useState(target);
  const valueRef = React.useRef(value);
  React.useLayoutEffect(() => {
    valueRef.current = value;
  });
  const [prev, setPrev] = React.useState({ on, key });
  if (prev.on !== on || prev.key !== key) {
    setPrev({ on, key });
    if (prev.key !== key || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
    }
  }

  const stop = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    const from = valueRef.current;
    if (from === target) return;
    const ease = readEasing('--ease-slide');
    const duration = ease ? readDuration('--duration-move') : 0;
    // A tween cut short goes back the share of the way it had come, at the same pace
    const span = duration * Math.abs(target - from);
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = span ? Math.min(1, (now - start) / span) : 1;
      setValue(t >= 1 ? target : from + (target - from) * (ease?.(t) ?? 1));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const timer = setTimeout(() => {
      cancelAnimationFrame(frame);
      setValue(target);
    }, span + FINISH_GRACE);
    const end = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
    stop.current = () => {
      end();
      setValue(target);
    };
    return () => {
      end();
      stop.current = () => {};
    };
  }, [target, key]);

  const finish = React.useCallback(() => stop.current(), []);
  return { value, finish };
}
