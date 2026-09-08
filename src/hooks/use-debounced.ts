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

  // Ref'e render SIRASINDA yazmak eşzamanlı mod ile uyumsuz; effect'te
  // güncelliyoruz. Gecikmeli çağrı zaten bir sonraki tick'te çalışıyor,
  // o zamana kadar ref taze olur.
  useEffect(() => {
    latest.current = fn;
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
