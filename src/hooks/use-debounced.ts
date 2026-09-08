"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Sayı girişlerinde her tuş vuruşunda gezinme yapmamak için.
 * Bileşen kaldırıldığında bekleyen çağrıyı iptal eder.
 */
export function useDebounced<A extends unknown[]>(
  fn: (...args: A) => void,
  delay = 400,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
