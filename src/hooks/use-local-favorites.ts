"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "davetmekani:favoriler";
const EVENT = "davetmekani:favoriler-degisti";

/**
 * Üye olmayan kullanıcının favorileri. Giriş yapıldığında bu liste
 * `syncLocalFavorites()` ile hesaba aktarılacak (P5) — o yüzden format
 * bilerek basit: mekan id'lerinden oluşan bir dizi.
 */
function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  // Aynı sekmedeki diğer kart bileşenlerinin de haberi olsun; `storage`
  // olayı yalnızca DİĞER sekmelerde tetikleniyor.
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useLocalFavorites() {
  const [ids, setIds] = useState<string[]>([]);
  // Sunucuda localStorage yok; ilk render'da boş liste dönüp hydration
  // sonrası dolduruyoruz. `ready` bayrağı, kalp ikonunun bir an boş görünüp
  // sonra dolmasını (yanıp sönme) engellemek için.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIds(read());
    setReady(true);
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    write(next);
    setIds(next);
    return next.includes(id);
  }, []);

  return { ids, ready, toggle, isFavorite: (id: string) => ids.includes(id) };
}
