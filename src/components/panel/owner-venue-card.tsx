import Image from "next/image";
import Link from "next/link";
import { Eye, Inbox } from "lucide-react";
import { VenueStatusBadge } from "./venue-status-badge";
import { venueHref } from "@/components/venue/venue-card";
import { formatNumber } from "@/lib/format";
import type { OwnerVenue } from "@/types/db";

/** Panelde ve "Mekanlarım" listesinde kullanılan mekan kartı. */
export function OwnerVenueCard({ venue }: { venue: OwnerVenue }) {
  return (
    <article className="group relative overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-[16/10] bg-muted">
        {venue.cover_url ? (
          <Image
            src={venue.cover_url}
            alt=""
            fill
            sizes="(min-width: 1280px) 320px, (min-width: 640px) 45vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-xs text-muted-foreground">
            Fotoğraf yok
          </div>
        )}
        <div className="absolute left-3 top-3">
          <VenueStatusBadge status={venue.status} needsReview={venue.needs_review} />
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="font-medium leading-snug">
            <Link
              href={`/panel/mekanlarim/${venue.id}`}
              className="after:absolute after:inset-0"
            >
              {venue.name}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">
            {venue.district_name}, {venue.city_name}
          </p>
        </div>

        {venue.completion_score < 100 ? (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Profil tamamlanma</span>
              <span className="tabular font-medium">%{venue.completion_score}</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={venue.completion_score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profil tamamlanma oranı"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${venue.completion_score}%` }}
              />
            </div>
          </div>
        ) : null}

        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Eye className="size-3.5" aria-hidden />
            <dd className="tabular">{formatNumber(venue.view_count)}</dd>
          </div>
          <div className="flex items-center gap-1">
            <Inbox className="size-3.5" aria-hidden />
            <dd className="tabular">
              {formatNumber(venue.inquiry_count)}
              {Number(venue.new_inquiries) > 0 ? (
                <span className="ml-1 text-primary">
                  ({Number(venue.new_inquiries)} yeni)
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        {venue.status === "PUBLISHED" ? (
          <Link
            href={venueHref({
              citySlug: venue.city_slug,
              districtSlug: venue.district_slug,
              slug: venue.slug,
            })}
            target="_blank"
            className="relative z-10 inline-block text-xs font-medium text-primary hover:underline"
          >
            Yayındaki sayfayı gör →
          </Link>
        ) : null}
      </div>
    </article>
  );
}
