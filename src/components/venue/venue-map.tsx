import { ExternalLink, MapPin } from "lucide-react";

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
}: {
  name: string;
  address: string | null;
  districtName: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const hasCoords = latitude !== null && longitude !== null;
  const query = encodeURIComponent(`${name}, ${districtName}, ${cityName}`);
  const externalHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;

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
        <div className="overflow-hidden rounded-xl border">
          <iframe
            title={`${name} konumu`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`}
            className="h-[320px] w-full border-0"
          />
        </div>
      ) : (
        <div className="grid h-[180px] place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Bu mekan için harita konumu eklenmemiş
        </div>
      )}

      <a
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Haritada aç
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}
