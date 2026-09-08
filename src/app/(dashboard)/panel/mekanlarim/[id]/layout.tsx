import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { StepNav } from "@/components/venue-editor/step-nav";
import { VenueStatusBadge } from "@/components/panel/venue-status-badge";
import { getVenueForEdit } from "@/lib/services/owner";
import { stepCompletion } from "@/lib/venue-steps";
import { venueHref } from "@/components/venue/venue-card";

export default async function VenueEditorLayout({
  children,
  params,
}: LayoutProps<"/panel/mekanlarim/[id]">) {
  const { id } = await params;
  const venue = await getVenueForEdit(id);
  // Sahibi olmadığı mekan için RPC null döner → 404. "Yetkin yok" demek
  // mekanın varlığını sızdırır.
  if (!venue) notFound();

  const completed = stepCompletion(venue);

  return (
    <div className="px-4 py-6 sm:px-8 lg:py-8">
      <div className="mb-6">
        <Link
          href="/panel/mekanlarim"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Mekanlarım
        </Link>
      </div>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl sm:text-3xl">{venue.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <VenueStatusBadge status={venue.status} needsReview={venue.needs_review} />
            <span className="tabular text-sm text-muted-foreground">
              Profil %{venue.completion_score} tamamlandı
            </span>
          </div>
        </div>
        {venue.status === "PUBLISHED" ? (
          <Link
            href={venueHref({
              citySlug: venue.city.slug,
              districtSlug: venue.district.slug,
              slug: venue.slug,
            })}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Yayındaki sayfayı gör
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </header>

      {venue.status === "REJECTED" && venue.rejection_reason ? (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Yayın talebi reddedildi</p>
          <p className="mt-1 text-sm text-muted-foreground">{venue.rejection_reason}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Düzeltmeleri yapıp tekrar gönderebilirsiniz.
          </p>
        </div>
      ) : null}

      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
        <aside className="mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-8">
            <StepNav venueId={venue.id} completed={completed} />
          </div>
        </aside>
        <div className="min-w-0 max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
