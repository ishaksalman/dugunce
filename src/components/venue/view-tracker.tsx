"use client";

import { useEffect } from "react";

/**
 * Detay sayfası görüntülenmesini bir kez bildirir.
 *
 * `sessionStorage` ile aynı oturumda aynı mekan için tekrar sayılmıyor;
 * kullanıcının sekmeler arasında gidip gelmesi sayacı şişirmesin.
 */
export function ViewTracker({ venueId }: { venueId: string }) {
  useEffect(() => {
    const key = `dugunce:goruntulendi:${venueId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Gizli sekmede sessionStorage kapalı olabilir; sayacı yine de bildir.
    }

    const url = `/api/venues/${venueId}/view`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    }
  }, [venueId]);

  return null;
}
