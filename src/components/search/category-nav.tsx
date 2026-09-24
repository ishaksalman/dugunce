import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BusinessCategory } from "@/types/db";

/**
 * "Ne arıyorsun?" — işletme kategorisi seçimi.
 *
 * Etkinlik türünden (düğün, nişan, kına) BİR ÜST katman: kategori işletmenin
 * ne olduğu, etkinlik türü ise mekanın hangi organizasyona uygun olduğu.
 *
 * Görsel kart — "Popüler şehirler" ile AYNI desen (görsel + degrade + alt
 * yazı), ikon değil: kategori sayısı azken bir fotoğraf ikondan daha
 * davetkâr. Gerçek kategori fotoğrafımız yok; şehir kartlarındaki gibi
 * seed'li placeholder kullanılıyor (bkz. picsum, ana sayfanın geri kalanıyla
 * tutarlı — canlıya alırken gerçek görsellerle değiştirilmeli).
 *
 * Liste veritabanından geliyor (`business_categories`). Planlanan kategoriler
 * pasif satır olarak duruyor ve burada "yakında" etiketiyle, TIKLANAMAZ,
 * soluk/gri tonlu görünüyor — ölü bağlantı üretmiyoruz. Kategori yayına
 * girdiğinde yapılacak tek şey `is_active = true`.
 */
export function CategoryNav({ categories }: { categories: BusinessCategory[] }) {
  if (categories.length < 2) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((k) => {
        const gorsel = (
          <div className="relative aspect-[4/5]">
            <Image
              src={`https://picsum.photos/seed/dugunce-kategori-${k.slug}/500/625`}
              alt=""
              fill
              sizes="(min-width: 1024px) 160px, 45vw"
              className={cn(
                "object-cover transition-transform duration-500",
                k.is_active ? "group-hover:scale-105" : "grayscale",
              )}
            />
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-t from-brand-950/85 via-brand-950/25 to-transparent",
                !k.is_active && "bg-brand-950/40",
              )}
            />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="font-heading text-base text-white">{k.name}</p>
              {!k.is_active ? (
                <p className="text-xs text-white/70">Yakında</p>
              ) : null}
            </div>
          </div>
        );

        return (
          <li key={k.id}>
            {k.is_active ? (
              <Link
                href={`/${k.path_prefix}`}
                className="group relative block overflow-hidden rounded-xl"
              >
                {gorsel}
              </Link>
            ) : (
              // Bağlantı DEĞİL: gidecek bir sayfa yok. `aria-disabled` ile
              // ekran okuyucuya da aynı şey söyleniyor.
              <div
                aria-disabled="true"
                className="relative block cursor-default overflow-hidden rounded-xl"
              >
                {gorsel}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
