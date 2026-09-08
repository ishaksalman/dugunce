"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "davetmekani:favoriler";
const EVENT = "davetmekani:favoriler-degisti";

/**
 * Üye olmayan kullanıcının favorileri.
 *
 * `useSyncExternalStore` kullanılıyor: localStorage bir dış depo ve
 * useEffect + useState ile okumak hem hydration'da yanıp sönmeye hem
 * zincirleme render'a yol açıyor.
 */

const BOS: string[] = [];
// getSnapshot her render'da AYNI referansı döndürmeli; yoksa React sonsuz
// döngüye girer. Bu yüzden ayrıştırılmış değeri ham metne göre önbelleğe
// alıyoruz.
let sonHam: string | null = null;
let sonListe: string[] = BOS;

function oku(): string[] {
  if (typeof window === "undefined") return BOS;
  let ham: string | null = null;
  try {
    ham = window.localStorage.getItem(KEY);
  } catch {
    return BOS;
  }
  if (ham === sonHam) return sonListe;
  sonHam = ham;
  try {
    const parsed: unknown = ham ? JSON.parse(ham) : [];
    sonListe = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : BOS;
  } catch {
    sonListe = BOS;
  }
  return sonListe;
}

function abone(callback: () => void) {
  window.addEventListener(EVENT, callback);
  // `storage` olayı yalnızca DİĞER sekmelerde tetikleniyor; aynı sekme için
  // kendi olayımızı yayıyoruz.
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useLocalFavorites() {
  const ids = useSyncExternalStore(abone, oku, () => BOS);
  // Sunucuda liste her zaman boş; hydration bittiğinde gerçek değer gelir.
  const ready = ids !== BOS || typeof window !== "undefined";

  const toggle = useCallback((id: string) => {
    const current = oku();
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
    return next.includes(id);
  }, []);

  return { ids, ready, toggle, isFavorite: (id: string) => ids.includes(id) };
}
