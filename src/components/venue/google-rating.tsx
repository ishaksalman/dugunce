import { ExternalLink, Star } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";

/**
 * Google işletme puanı.
 *
 * Gösterilen SAYI; yorum METİNLERİ değil. Sayı olgudur, yorum metni onu
 * yazan kişinin eseridir ve telifi bizde değil — okumak isteyen Google'a
 * gidiyor.
 *
 * Üç kural:
 *
 * 1. Bu puan kendi `rating_avg`'imizle KARIŞMAZ ve JSON-LD
 *    `aggregateRating`'imize GİRMEZ (bkz. lib/seo/jsonld.ts). Başkasının
 *    puanını kendi işaretlememizde göstermek Google'ın yapılandırılmış veri
 *    politikasına aykırı.
 * 2. Kaynak açıkça yazılır ve okunma tarihi gösterilir.
 * 3. Bayat puan GÖSTERİLMEZ — ama bu kararı burada VERMİYORUZ. Tazelik
 *    kontrolü `get_venue_detail` içinde (0034): sayfa prerender edildiği
 *    için burada `Date.now()` okumak build anında donuyordu ve puan hiç
 *    düşmüyordu. Sorgu bayat puanı null döndürüyor, biz de basmıyoruz.
 */

export function GoogleRating({
  rating,
  count,
  readAt,
  placeId,
}: {
  rating: string | number | null;
  count: number | null;
  readAt: string | null;
  /**
   * Yorum bağlantısı bundan kurulur — `google_maps_url` çoğunlukla kaynağın
   * verdiği yol tarifi adresi, yorum sayfası değil (bkz. VenueMap).
   */
  placeId: string | null;
}) {
  if (rating === null || readAt === null) return null;

  const puan = Number(rating);
  if (!Number.isFinite(puan) || puan <= 0) return null;

  const baglanti = placeId
    ? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`
    : null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Star className="size-4 translate-y-0.5 fill-current text-primary" aria-hidden />
        <span className="tabular text-lg font-medium">
          {puan.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}
        </span>
        <span className="text-sm text-muted-foreground">
          Google&apos;da
          {count !== null && count > 0
            ? ` ${formatNumber(count)} değerlendirme`
            : ""}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        {/* Kaynağı ve tarihi saklamıyoruz: kullanıcı neyin ne zamanki verisi
            olduğunu bilsin. */}
        Google Haritalar&apos;dan {formatDate(readAt)} tarihinde alındı.
        {" "}Düğünce değerlendirmelerinden ayrıdır.
      </p>

      {baglanti ? (
        <a
          href={baglanti}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Google&apos;da yorumları oku
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
