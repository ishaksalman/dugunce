"use client";

import { useEffect, useState } from "react";
import { useLocalFavorites } from "@/hooks/use-local-favorites";
import { VenueCard, VenueCardSkeleton, VenueGrid } from "./venue-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import type { VenueCardData } from "@/types/db";

/**
 * Favoriler tarayıcıda tutulduğu için liste istemcide kuruluyor: id'ler
 * localStorage'dan okunuyor, kart verisi API'den geliyor.
 *
 * Sunucuda render edilemez — sunucu kullanıcının neyi favorilediğini
 * bilmiyor ve bilmesine de gerek yok.
 */
export function FavoritesList() {
  const { ids, toggle } = useLocalFavorites();
  /**
   * Tek bir sonuç state'i: hangi id listesi için ne döndüğünü birlikte
   * tutuyoruz. Ayrı `yukleniyor` / `hata` state'leri effect içinde eşzamanlı
   * `setState` gerektirir ve zincirleme render tetikler.
   */
  const [sonuc, setSonuc] = useState<
    { anahtar: string; venues: VenueCardData[] } | { anahtar: string; hata: true } | null
  >(null);

  // İstek anahtarı: id listesi değişince yeniden çekilir. Kullanıcı listeden
  // bir mekanı çıkarınca da tetiklenir.
  const anahtar = ids.join(",");
  const guncel = sonuc?.anahtar === anahtar ? sonuc : null;
  const hata = guncel !== null && "hata" in guncel;
  // Favori yoksa istek atmaya gerek yok; boş liste türetiliyor, state'e
  // yazılmıyor — effect içinde eşzamanlı setState zincirleme render demek.
  const venues = anahtar === ""
    ? []
    : guncel !== null && "venues" in guncel
      ? guncel.venues
      : null;

  useEffect(() => {
    if (!anahtar) return;
    const controller = new AbortController();
    fetch(`/api/venues/by-ids?ids=${encodeURIComponent(anahtar)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { venues: VenueCardData[] }) => setSonuc({ anahtar, venues: d.venues }))
      .catch((e) => {
        if (e.name !== "AbortError") setSonuc({ anahtar, hata: true });
      });
    return () => controller.abort();
  }, [anahtar]);

  if (hata) {
    return <ErrorState description="Favori mekanların yüklenemedi." />;
  }

  if (venues === null) {
    return (
      <VenueGrid>
        {Array.from({ length: Math.min(ids.length || 3, 6) }, (_, i) => (
          <VenueCardSkeleton key={i} />
        ))}
      </VenueGrid>
    );
  }

  if (venues.length === 0) {
    return (
      <EmptyState
        title="Henüz favorin yok"
        description="Beğendiğin mekanların kalp ikonuna dokun, burada biriksinler."
        action={{ label: "Mekanları keşfet", href: "/mekanlar" }}
      />
    );
  }

  // Yayından kalkan mekanlar API'den dönmüyor; listeden de düşürüyoruz ki
  // kullanıcı ulaşamadığı bir favoriyle kalmasın.
  const eksik = ids.length - venues.length;

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        <span className="tabular font-medium text-foreground">{venues.length}</span> mekan
        {eksik > 0 ? ` · ${eksik} mekan artık yayında değil` : ""}
      </p>
      <VenueGrid>
        {venues.map((v, i) => (
          <VenueCard key={v.id} venue={v} priority={i < 3} />
        ))}
      </VenueGrid>
      {eksik > 0 ? (
        <button
          type="button"
          onClick={() => {
            const gecerli = new Set(venues.map((v) => v.id));
            for (const id of ids) if (!gecerli.has(id)) toggle(id);
          }}
          className="mt-8 text-sm text-primary hover:underline"
        >
          Yayında olmayan {eksik} mekanı listemden çıkar
        </button>
      ) : null}
    </>
  );
}
