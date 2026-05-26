import { useState, useEffect, useRef, useCallback } from 'react';

export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface CountdownTick {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True on the first render only — used to suppress the tick animation */
  isFirst: boolean;
}

const TARGET_DATE = new Date('2026-05-30T21:00:00-03:00').getTime();

function compute(): CountdownState {
  let diff = Math.max(0, TARGET_DATE - Date.now());
  const days    = Math.floor(diff / 86_400_000); diff -= days    * 86_400_000;
  const hours   = Math.floor(diff /  3_600_000); diff -= hours   *  3_600_000;
  const minutes = Math.floor(diff /     60_000); diff -= minutes *     60_000;
  const seconds = Math.floor(diff /      1_000);
  return { days, hours, minutes, seconds };
}

export function useCountdown(intervalMs = 250): CountdownTick {
  const isFirst  = useRef(true);
  const prevRef  = useRef<CountdownState>({ days: -1, hours: -1, minutes: -1, seconds: -1 });
  const [tick, setTick] = useState<CountdownTick>(() => {
    const s = compute();
    prevRef.current = s;
    return { ...s, isFirst: true };
  });

  const update = useCallback(() => {
    const next = compute();
    const prev = prevRef.current;
    const changed =
      next.days    !== prev.days    ||
      next.hours   !== prev.hours   ||
      next.minutes !== prev.minutes ||
      next.seconds !== prev.seconds;

    if (changed) {
      const first = isFirst.current;
      isFirst.current = false;
      prevRef.current = next;
      setTick({ ...next, isFirst: first });
    }
  }, []);

  useEffect(() => {
    update(); // sync immediately
    const id = setInterval(update, intervalMs);
    return () => clearInterval(id);
  }, [update, intervalMs]);

  

  return tick;
}
