import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCapacity, formatRating, formatStartingPrice } from "@/lib/format";
import { FavoriteButton } from "./favorite-button";
import type { VenueCardData } from "@/types/db";

export function venueHref(v: Pick<VenueCardData, "citySlug" | "districtSlug" | "slug">) {
  return `/mekanlar/${v.citySlug}/${v.districtSlug}/${v.slug}`;
}

/**
 * Kart bilinçli olarak az bilgi taşıyor: görsel, isim, konum, kapasite,
 * fiyat ve puan. Özellik rozetleri, açıklama ve hizmet listesi detay
 * sayfasında — kartta kullanıcıyı boğmuyoruz.
 */
export function VenueCard({
  venue,
  priority = false,
  className,
}: {
  venue: VenueCardData;
  /** İlk ekranda görünen kartlar için LCP optimizasyonu. */
  priority?: boolean;
  className?: string;
}) {
  const capacity = formatCapacity(venue.minCapacity, venue.maxCapacity);
  const price = formatStartingPrice(venue.startingPrice, venue.priceType);

  return (
    <article className={cn("group relative", className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        {venue.coverUrl ? (
          <Image
            src={venue.coverUrl}
            alt={`${venue.name} — ${venue.districtName}, ${venue.cityName}`}
            fill
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 33vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            priority={priority}
            placeholder={venue.coverBlur ? "blur" : undefined}
            blurDataURL={venue.coverBlur ?? undefined}
          />
        ) : (
          <div className="grid size-full place-items-center text-sm text-muted-foreground">
            Görsel yok
          </div>
        )}

        {venue.isFeatured ? (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium tracking-wide backdrop-blur">
            Öne Çıkan
          </span>
        ) : null}

        {/* z-10 şart: kartı tıklanabilir yapan `after:inset-0` katmanı DOM'da
            sonra geldiği için varsayılan sıralamada kalbin üstünde kalıyor ve
            tıklamayı yutuyor. */}
        <FavoriteButton
          venueId={venue.id}
          venueName={venue.name}
          className="absolute right-3 top-3 z-10"
        />
      </div>

      <div className="space-y-1 pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-lg leading-snug">
            {/* Tüm kartı tıklanabilir yapan görünmez katman. */}
            <Link href={venueHref(venue)} className="after:absolute after:inset-0">
              {venue.name}
            </Link>
          </h3>
          {venue.ratingCount > 0 ? (
            <span className="flex shrink-0 items-center gap-1 pt-1 text-sm">
              <Star className="size-3.5 fill-foreground text-foreground" aria-hidden />
              <span className="tabular font-medium">{formatRating(venue.ratingAvg)}</span>
              <span className="text-muted-foreground">({venue.ratingCount})</span>
            </span>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {venue.districtName}, {venue.cityName}
          {venue.venueTypeName ? ` · ${venue.venueTypeName}` : ""}
        </p>

        {capacity ? <p className="tabular text-sm text-muted-foreground">{capacity}</p> : null}

        <p className="pt-1 text-sm">
          <span className="tabular font-medium">{price.primary}</span>
          {price.secondary ? (
            <span className="text-muted-foreground"> · {price.secondary}</span>
          ) : null}
        </p>
      </div>
    </article>
  );
}

export function VenueCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/3] rounded-xl bg-muted" />
      <div className="space-y-2 pt-3">
        <div className="h-5 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="h-4 w-2/5 rounded bg-muted" />
        <div className="h-4 w-3/5 rounded bg-muted" />
      </div>
    </div>
  );
}

export function VenueGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}
