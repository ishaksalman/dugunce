import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { VenueStatusBadge } from "@/components/panel/venue-status-badge";
import { ReviewDecision } from "@/components/admin/review-decision";
import { getVenueForEdit } from "@/lib/services/owner";
import { getFeatures } from "@/lib/services/taxonomy";
import { formatCapacity, formatDate, formatStartingPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Mekan İnceleme",
  robots: { index: false, follow: false },
};

/**
 * Yönetici inceleme ekranı.
 *
 * İnceleme bekleyen mekan vitrinde görünmüyor (get_venue_detail yalnızca
 * PUBLISHED döndürüyor), o yüzden onaylayacak kişinin mekanı göreceği yer
 * burası. `get_venue_for_edit` admin'e de açık (0010).
 */
export default async function AdminVenueReview({
  params,
}: {
  // Rota tipleri henüz üretilmediği için elle yazıldı; `next dev`
  // çalıştıktan sonra PageProps<"/yonetim/mekanlar/[id]"> kullanılabilir.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [venue, features] = await Promise.all([getVenueForEdit(id), getFeatures()]);
  if (!venue) notFound();

  const secili = new Set(venue.feature_ids);
  const ozellikler = features.filter((f) => secili.has(f.id));
  const price = formatStartingPrice(
    venue.starting_price === null ? null : Number(venue.starting_price),
    venue.price_type,
  );

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <Link
        href="/yonetim/mekanlar"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mekanlar
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl">{venue.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {venue.district.name}, {venue.city.name}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <VenueStatusBadge status={venue.status} needsReview={venue.needs_review} />
            <span className="tabular text-sm text-muted-foreground">
              Profil %{venue.completion_score}
            </span>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
        <div className="min-w-0 space-y-8">
          <Bolum baslik={`Fotoğraflar (${venue.images.length})`}>
            {venue.images.length === 0 ? (
              <Bos>Fotoğraf eklenmemiş.</Bos>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {venue.images.map((img) => (
                  <li key={img.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={img.url}
                      alt={img.alt ?? ""}
                      fill
                      sizes="(min-width: 640px) 160px, 45vw"
                      className="object-cover"
                    />
                    {img.is_cover ? (
                      <span className="absolute left-1.5 top-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                        Kapak
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Bolum>

          <Bolum baslik="Genel bilgiler">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Bilgi label="Kapasite" deger={formatCapacity(venue.min_capacity, venue.max_capacity)} />
              <Bilgi label="Fiyat" deger={price.primary} />
              <Bilgi label="Açık alan" deger={venue.has_outdoor ? "Var" : "Yok"} />
              <Bilgi label="Kapalı alan" deger={venue.has_indoor ? "Var" : "Yok"} />
              <Bilgi label="Telefon" deger={venue.contact_phone} />
              <Bilgi label="E-posta" deger={venue.contact_email} />
              <Bilgi label="Web" deger={venue.website_url} />
              <Bilgi label="Instagram" deger={venue.instagram_url} />
              <Bilgi
                label="Konum"
                deger={
                  venue.latitude !== null && venue.longitude !== null
                    ? `${venue.latitude}, ${venue.longitude}`
                    : null
                }
              />
            </dl>
            {venue.address ? (
              <p className="mt-4 text-sm text-muted-foreground">{venue.address}</p>
            ) : null}
          </Bolum>

          <Bolum baslik={`Özellikler ve hizmetler (${ozellikler.length})`}>
            {ozellikler.length === 0 ? (
              <Bos>Özellik seçilmemiş.</Bos>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {ozellikler.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    {f.name}
                  </li>
                ))}
              </ul>
            )}
          </Bolum>

          <Bolum baslik="Açıklama">
            {venue.description ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {venue.description}
              </p>
            ) : (
              <Bos>Açıklama yazılmamış.</Bos>
            )}
          </Bolum>

          {venue.price_note ? (
            <Bolum baslik="Fiyat açıklaması">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {venue.price_note}
              </p>
            </Bolum>
          ) : null}
        </div>

        <aside className="mt-8 lg:mt-0">
          <div className="lg:sticky lg:top-8">
            <ReviewDecision
              venueId={venue.id}
              status={venue.status}
              isFeatured={false}
              rejectionReason={venue.rejection_reason}
            />
            <dl className="mt-6 space-y-2 rounded-xl border bg-card p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Oluşturuldu</dt>
                <dd className="tabular">
                  {venue.published_at ? formatDate(venue.published_at) : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Web adresi</dt>
                <dd className="truncate pl-2 font-mono text-xs">{venue.slug}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-heading text-lg">{baslik}</h2>
      {children}
    </section>
  );
}

function Bilgi({ label, deger }: { label: string; deger: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 break-words text-sm font-medium">{deger ?? "—"}</dd>
    </div>
  );
}

function Bos({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
