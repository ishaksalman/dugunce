import Image from "next/image";
import { Eye, Inbox, Star } from "lucide-react";
import { VenueStatusBadge } from "@/components/panel/venue-status-badge";
import { VenueModerationActions } from "./venue-moderation-actions";
import { formatDate, formatNumber } from "@/lib/format";
import type { AdminVenue } from "@/types/db";

/** Onay kuyruğu ve mekan listesindeki satır. */
export function AdminVenueRow({ venue }: { venue: AdminVenue }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex gap-4">
        <div className="relative hidden aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-lg bg-muted sm:block">
          {venue.cover_url ? (
            <Image
              src={venue.cover_url}
              alt=""
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-[11px] text-muted-foreground">
              Fotoğraf yok
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">{venue.name}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {venue.district_name}, {venue.city_name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {venue.owner_name}
                {venue.owner_email ? ` · ${venue.owner_email}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {venue.is_featured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                  <Star className="size-3 fill-current" aria-hidden />
                  Öne çıkan
                </span>
              ) : null}
              <VenueStatusBadge status={venue.status} needsReview={venue.needs_review} />
            </div>
          </div>

          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="tabular">%{venue.completion_score}</span> tamamlandı
            </div>
            <div className="flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden />
              <dd className="tabular">{formatNumber(venue.view_count)}</dd>
            </div>
            <div className="flex items-center gap-1">
              <Inbox className="size-3.5" aria-hidden />
              <dd className="tabular">{formatNumber(venue.inquiry_count)}</dd>
            </div>
            <div className="tabular">Güncelleme: {formatDate(venue.updated_at)}</div>
          </dl>

          {venue.rejection_reason ? (
            <p className="mt-3 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Gerekçe: {venue.rejection_reason}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <VenueModerationActions venue={venue} />
          </div>
        </div>
      </div>
    </article>
  );
}
