import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Eye, Heart, Inbox, Plus, TrendingUp, TriangleAlert,
} from "lucide-react";
import { ButtonLink } from "@/components/shared/button-link";
import { EmptyState } from "@/components/shared/states";
import { VenueStatusBadge } from "@/components/panel/venue-status-badge";
import { getMyVenues, getOwnerStats } from "@/lib/services/owner";
import { formatNumber, formatRating } from "@/lib/format";
import { venueHref } from "@/components/venue/venue-card";
import type { OwnerVenue } from "@/types/db";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

export default async function PanelDashboard() {
  const venues = await getMyVenues();

  if (venues.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
        <EmptyState
          title="Henüz mekanınız yok"
          description="İlk mekanınızı oluşturun, teklif talepleri doğrudan size ulaşsın. Listeleme ücretsiz."
          action={{ label: "Mekan oluştur", href: "/panel/mekanlarim/yeni" }}
        />
      </div>
    );
  }

  // Toplam kutucuklar tüm mekanların birleşimi; tek mekanı olan sahip için
  // de anlamlı çalışıyor.
  const toplam = venues.reduce(
    (acc, v) => ({
      view: acc.view + v.view_count,
      inquiry: acc.inquiry + v.inquiry_count,
      yeni: acc.yeni + Number(v.new_inquiries),
    }),
    { view: 0, inquiry: 0, yeni: 0 },
  );

  // Favori sayısı ve dönüşüm için mekan bazlı istatistik gerekiyor.
  const statsList = await Promise.all(venues.map((v) => getOwnerStats(v.id)));
  const favoriToplam = statsList.reduce((n, s) => n + (s ? s.favorite_count : 0), 0);
  const donusum = toplam.view > 0 ? (toplam.inquiry / toplam.view) * 100 : 0;

  const dikkatGerektiren = venues.filter(
    (v) => v.status === "DRAFT" || v.status === "REJECTED" || v.needs_review,
  );

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl">Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {venues.length} mekanınızın özeti
          </p>
        </div>
        <ButtonLink href="/panel/mekanlarim/yeni" size="lg" className="h-10 gap-2">
          <Plus className="size-4" aria-hidden />
          Yeni mekan
        </ButtonLink>
      </header>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={<Eye className="size-4" />}
          label="Görüntülenme"
          value={formatNumber(toplam.view)}
        />
        <StatTile
          icon={<Heart className="size-4" />}
          label="Favoriye eklenme"
          value={formatNumber(favoriToplam)}
        />
        <StatTile
          icon={<Inbox className="size-4" />}
          label="Teklif talebi"
          value={formatNumber(toplam.inquiry)}
          hint={toplam.yeni > 0 ? `${toplam.yeni} yeni` : undefined}
        />
        <StatTile
          icon={<TrendingUp className="size-4" />}
          label="Dönüşüm oranı"
          value={`%${formatRating(donusum)}`}
          hint="görüntülenme → talep"
        />
      </dl>

      {dikkatGerektiren.length > 0 ? (
        <section className="mt-8 rounded-xl border border-warning/40 bg-warning/5 p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4 text-warning" aria-hidden />
            Dikkat gerektiren mekanlar
          </h2>
          <ul className="mt-3 space-y-2">
            {dikkatGerektiren.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Link
                  href={`/panel/mekanlarim/${v.id}`}
                  className="font-medium hover:underline"
                >
                  {v.name}
                </Link>
                <VenueStatusBadge status={v.status} needsReview={v.needs_review} />
                <span className="text-muted-foreground">
                  {v.status === "DRAFT"
                    ? `Profil %${v.completion_score} tamamlandı — yayına göndermek için %60 gerekir`
                    : v.status === "REJECTED"
                      ? (v.rejection_reason ?? "Düzenleme sonrası tekrar gönderebilirsiniz")
                      : "Değişiklikleriniz inceleme kuyruğunda"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl">Mekanlarım</h2>
          <Link
            href="/panel/mekanlarim"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Tümü
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {venues.slice(0, 6).map((v) => (
            <li key={v.id}>
              <OwnerVenueCard venue={v} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className="tabular mt-2 text-2xl font-medium">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

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
