"use client";

import { useState } from "react";
import { ExternalLink, MapPin, Star } from "lucide-react";

/**
 * Konum bloğu.
 *
 * Harita için OpenStreetMap gömülü görünümü kullanılıyor: API anahtarı
 * gerektirmiyor ve maliyeti yok. Google Maps'e geçilecekse tek yer burası.
 * Tam adres yerine yaklaşık konum gösteriliyor — kesin adres teklif
 * sonrasında mekan tarafından paylaşılır.
 */
export function VenueMap({
  name,
  address,
  districtName,
  cityName,
  latitude,
  longitude,
  googlePlaceId,
}: {
  name: string;
  address: string | null;
  districtName: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  /**
   * Yorum bağlantısı bundan kurulur — `google_maps_url` çoğunlukla kaynağın
   * verdiği YOL TARİFİ adresi (bkz. AGENTS.md: "Apify'ın url alanı ARAMA
   * adresidir"), yorum sayfası değil. place_id'den kurulan
   * `query_place_id` adresi doğrudan işletmenin Maps kartını açıyor.
   */
  googlePlaceId: string | null;
}) {
  const [aktif, setAktif] = useState(false);
  const hasCoords = latitude !== null && longitude !== null;
  const query = encodeURIComponent(`${name}, ${districtName}, ${cityName}`);
  const externalHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
  const reviewHref = googlePlaceId
    ? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(googlePlaceId)}`
    : null;

  // Yaklaşık 1.5 km'lik bir çerçeve; nokta hassasiyeti gerekmiyor.
  const delta = 0.008;
  const bbox = hasCoords
    ? [longitude - delta, latitude - delta / 2, longitude + delta, latitude + delta / 2].join(",")
    : null;

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {address ? `${address} · ` : ""}
          {districtName}, {cityName}
        </span>
      </p>

      {hasCoords ? (
        <div className="relative overflow-hidden rounded-xl border">
          <iframe
            title={`${name} konumu`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`}
            className="h-[320px] w-full border-0"
          />
          {/* Harita kendi scroll/zoom'unu tıklamadan yakalıyor; sayfa
              kaydırılırken imleç haritanın üstüne gelince kilitleniyordu.
              Tıklanana kadar bu katman fare olaylarını yutuyor, wheel
              sayfaya geçiyor — Google/Maps gömme sayfalarında yaygın çözüm. */}
          {!aktif ? (
            <button
              type="button"
              onClick={() => setAktif(true)}
              className="absolute inset-0 flex items-center justify-center bg-foreground/5 text-sm font-medium text-foreground backdrop-blur-[1px] transition-colors hover:bg-foreground/10"
            >
              <span className="rounded-full bg-background/95 px-4 py-2 shadow-sm">
                Haritayla etkileşmek için tıklayın
              </span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid h-[180px] place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Bu mekan için harita konumu eklenmemiş
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Haritada aç
          <ExternalLink className="size-3.5" aria-hidden />
        </a>

        {/*
          place_id Google'ın kanonik kimliği (0032) — ad/telefon değişebilir,
          place_id değişmez, o yüzden yorum bağlantısı için güvenilir. Google
          PUANINI buraya YAZMIYORUZ — kendi aggregateRating'imize karışır ve
          lisanslı veriyi kopyalamış oluruz, yalnızca bağlantı veriyoruz.
        */}
        {reviewHref ? (
          <a
            href={reviewHref}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Star className="size-3.5" aria-hidden />
            Google&apos;da yorumları oku
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}
