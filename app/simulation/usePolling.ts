'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Poll an async function on an interval until `stop` returns true (or the
 * component unmounts / `enabled` goes false). Self-contained so the simulation
 * pages don't depend on a global React Query provider.
 */
export function usePolling<T>(
  fn: () => Promise<T>,
  opts: {
    intervalMs?: number;
    enabled?: boolean;
    stop?: (data: T) => boolean;
    onData?: (data: T) => void;
  } = {},
) {
  const { intervalMs = 2000, enabled = true, stop, onData } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const fnRef = useRef(fn);
  const stopRef = useRef(stop);
  const onDataRef = useRef(onData);
  fnRef.current = fn;
  stopRef.current = stop;
  onDataRef.current = onData;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!active) return;
      setLoading(true);
      try {
        const result = await fnRef.current();
        if (!active) return;
        setData(result);
        setError(null);
        onDataRef.current?.(result);
        if (stopRef.current?.(result)) {
          setLoading(false);
          return;
        }
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      }
      setLoading(false);
      if (active) timer = setTimeout(tick, intervalMs);
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, intervalMs]);

  return { data, error, loading };
}

/** One-shot async loader with manual refetch. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fnRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, error, loading, refetch: run };
}
