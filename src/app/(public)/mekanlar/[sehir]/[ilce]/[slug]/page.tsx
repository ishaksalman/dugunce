import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  Building2, ChevronRight, DoorOpen, Sun, Users, Wallet,
} from "lucide-react";
import { VenueGallery } from "@/components/venue/venue-gallery";
import { VenueMap } from "@/components/venue/venue-map";
import { ClaimCta } from "@/components/venue/claim-cta";
import { VenueReviews } from "@/components/venue/venue-reviews";
import { VenueCard, VenueGrid } from "@/components/venue/venue-card";
import { FavoriteButton } from "@/components/venue/favorite-button";
import { ShareButton } from "@/components/venue/share-button";
import { ViewTracker } from "@/components/venue/view-tracker";
import { InquiryForm } from "@/components/inquiry/inquiry-form";
import { StickyInquiryBar } from "@/components/inquiry/sticky-inquiry-bar";
import { Icon } from "@/components/shared/icon";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getSimilarVenues, getVenueDetail, getVenueReviews,
} from "@/lib/services/venues";
import { getEventTypes } from "@/lib/services/taxonomy";
import { breadcrumbJsonLd, venueJsonLd } from "@/lib/seo/jsonld";
import { formatCapacity, formatRating, formatStartingPrice } from "@/lib/format";
import { listVenueSitemap } from "@/lib/services/seo";
import { SITE } from "@/lib/constants";
import { landingHref, landingPath } from "@/lib/seo/paths";

// Detay sayfaları statik üretilir ve saatte bir tazelenir. Bu süre yalnızca
// ağ: mekan düzenlendiğinde, fotoğrafı değiştiğinde veya admin durumunu
// değiştirdiğinde `revalidateVenuePage` (lib/revalidate.ts) sayfayı anında
// yeniliyor. Askıya alınan mekanın bir saat daha vitrinde kalmaması için şart.
export const revalidate = 3600;

/**
 * Yayındaki mekanları build sırasında üretir.
 *
 * DİKKAT: bu fonksiyon olmadan Next rotayı hiç önbelleğe ALMIYOR —
 * `revalidate` yazılı olmasına rağmen prerender-manifest'e girmiyor ve
 * her istek sunucuda render ediliyordu. Mekan detayı landing sayfalarıyla
 * birlikte iki ana SEO yüzeyimizden biri.
 *
 * Listede olmayan (build'den sonra yayınlanan) mekan ilk istekte üretilip
 * önbelleğe alınır; `dynamicParams` varsayılanı bunu zaten yapıyor.
 */
export async function generateStaticParams() {
  const venues = await listVenueSitemap();
  return venues.slice(0, 500).map((v) => {
    const [, , sehir, ilce, slug] = v.path.split("/");
    return { sehir, ilce, slug };
  });
}

type Params = { sehir: string; ilce: string; slug: string };

function venuePath(p: Params) {
  return `/mekanlar/${p.sehir}/${p.ilce}/${p.slug}`;
}

export async function generateMetadata(
  { params }: PageProps<"/mekanlar/[sehir]/[ilce]/[slug]">,
): Promise<Metadata> {
  const p = (await params) as Params;
  const venue = await getVenueDetail(p.slug);
  if (!venue) return { title: "Mekan bulunamadı" };

  const canonical = `/mekanlar/${venue.city.slug}/${venue.district.slug}/${venue.slug}`;
  const capacity = formatCapacity(venue.min_capacity, venue.max_capacity);
  const description =
    venue.short_description ??
    `${venue.name}, ${venue.district.name} / ${venue.city.name}. ${
      capacity ? `${capacity}. ` : ""
    }Kapasite, fiyat ve hizmetleri inceleyin, ücretsiz teklif alın.`;

  return {
    title: `${venue.name} — ${venue.district.name}, ${venue.city.name}`,
    description: description.slice(0, 300),
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${venue.name} — ${venue.district.name}, ${venue.city.name}`,
      description: description.slice(0, 300),
      url: new URL(canonical, SITE.url).toString(),
      images: venue.images.slice(0, 4).map((i) => ({ url: i.url })),
    },
  };
}

export default async function VenueDetailPage(
  { params }: PageProps<"/mekanlar/[sehir]/[ilce]/[slug]">,
) {
  const p = (await params) as Params;
  const venue = await getVenueDetail(p.slug);
  if (!venue) notFound();

  // Slug tekil; şehir/ilçe segmentleri yanlışsa doğru adrese kalıcı yönlendir.
  // Aksi hâlde aynı içerik birden çok URL'den erişilebilir olurdu.
  if (venue.city.slug !== p.sehir || venue.district.slug !== p.ilce) {
    permanentRedirect(`/mekanlar/${venue.city.slug}/${venue.district.slug}/${venue.slug}`);
  }

  const [reviewData, eventTypes, similar] = await Promise.all([
    getVenueReviews(venue.id, 6),
    getEventTypes(),
    getSimilarVenues({
      id: venue.id,
      citySlug: venue.city.slug,
      eventTypeSlugs: venue.event_types.map((e) => e.slug),
    }),
  ]);

  const path = venuePath({ sehir: venue.city.slug, ilce: venue.district.slug, slug: venue.slug });
  const capacity = formatCapacity(venue.min_capacity, venue.max_capacity);
  const price = formatStartingPrice(
    venue.starting_price === null ? null : Number(venue.starting_price),
    venue.price_type,
  );
  const ratingAvg = Number(venue.rating_avg ?? 0);
  const ozellikler = venue.features.filter((f) => f.kind === "ozellik");
  const hizmetler = venue.features.filter((f) => f.kind === "hizmet");

  const breadcrumbs = [
    { name: "Ana sayfa", path: "/" },
    { name: "Mekanlar", path: "/mekanlar" },
    {
      name: venue.city.name,
      path: landingHref(landingPath({ citySlug: venue.city.slug, eventSlug: "dugun" })),
    },
    { name: venue.name, path },
  ];

  return (
    <>
      <JsonLd data={venueJsonLd(venue, path, reviewData.items)} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <ViewTracker venueId={venue.id} />

      <div className="container-page pb-28 pt-6 lg:pb-20">
        <Breadcrumbs items={breadcrumbs} />

        <div className="mt-4">
          <VenueGallery images={venue.images} venueName={venue.name} />
        </div>

        <div className="mt-8 lg:grid lg:grid-cols-[1fr_380px] lg:gap-12">
          <div className="min-w-0 space-y-10">
            {/* --- Başlık --- */}
            <header>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="font-heading text-3xl leading-tight sm:text-4xl">
                    {venue.name}
                  </h1>
                  <p className="mt-2 text-muted-foreground">
                    {venue.district.name}, {venue.city.name}
                    {venue.venue_type ? ` · ${venue.venue_type.name}` : ""}
                  </p>
                  {venue.rating_count > 0 ? (
                    <p className="mt-2 flex items-center gap-1.5 text-sm">
                      <span className="tabular font-medium">{formatRating(ratingAvg)}</span>
                      <span className="text-muted-foreground">
                        ({venue.rating_count} değerlendirme)
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ShareButton title={venue.name} />
                  <FavoriteButton
                    venueId={venue.id}
                    venueName={venue.name}
                    variant="plain"
                  />
                </div>
              </div>

              {venue.event_types.length > 0 ? (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {venue.event_types.map((e) => (
                    <li key={e.slug}>
                      <Link
                        href={landingHref(landingPath({ citySlug: venue.city.slug, eventSlug: e.slug }))}
                        className="inline-block rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-sage-200"
                      >
                        {e.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </header>

            {/* --- Genel bilgiler --- */}
            <Section title="Genel bilgiler">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                <Fact icon={<Users className="size-5" />} label="Kapasite" value={capacity} />
                <Fact
                  icon={<Building2 className="size-5" />}
                  label="Mekan türü"
                  value={venue.venue_type?.name ?? null}
                />
                <Fact
                  icon={<Sun className="size-5" />}
                  label="Açık alan"
                  value={venue.has_outdoor ? "Var" : "Yok"}
                />
                <Fact
                  icon={<DoorOpen className="size-5" />}
                  label="Kapalı alan"
                  value={venue.has_indoor ? "Var" : "Yok"}
                />
              </dl>
            </Section>

            {/* --- Fiyatlandırma --- */}
            <Section title="Fiyatlandırma">
              <div className="rounded-xl border p-5">
                <p className="flex items-baseline gap-2">
                  <Wallet className="size-5 shrink-0 self-center text-muted-foreground" aria-hidden />
                  <span className="tabular text-xl font-medium">{price.primary}</span>
                  {price.secondary ? (
                    <span className="text-sm text-muted-foreground">{price.secondary}</span>
                  ) : null}
                </p>
                {venue.price_note ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {venue.price_note}
                  </p>
                ) : null}
              </div>
            </Section>

            {/* --- Özellikler ve hizmetler --- */}
            {ozellikler.length > 0 ? (
              <Section title="Mekan özellikleri">
                <FeatureList items={ozellikler} />
              </Section>
            ) : null}

            {hizmetler.length > 0 ? (
              <Section title="Hizmetler">
                <FeatureList items={hizmetler} />
              </Section>
            ) : null}

            {/* --- Hakkında --- */}
            {venue.description ? (
              <Section title={`${venue.name} hakkında`}>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {venue.description}
                </p>
              </Section>
            ) : null}

            {/* --- Konum --- */}
            <Section title="Konum">
              <VenueMap
                name={venue.name}
                address={venue.address}
                districtName={venue.district.name}
                cityName={venue.city.name}
                latitude={venue.latitude === null ? null : Number(venue.latitude)}
                longitude={venue.longitude === null ? null : Number(venue.longitude)}
                googleMapsUrl={venue.google_maps_url}
              />
            </Section>

            {/* --- Sahiplenme çağrısı --- */}
            {/* Yalnızca yönetimin açtığı, henüz sahiplenilmemiş kayıtlarda. */}
            {!venue.is_claimed ? (
              <ClaimCta
                venueId={venue.id}
                venueName={venue.name}
                devam={path}
              />
            ) : null}

            {/* --- Yorumlar --- */}
            <Section title="Değerlendirmeler">
              <VenueReviews
                reviews={reviewData.items}
                total={reviewData.total}
                ratingAvg={ratingAvg}
                ratingCount={venue.rating_count}
              />
            </Section>
          </div>

          {/* --- Masaüstü teklif kartı --- */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-xl border bg-card p-6 shadow-sm">
              <InquiryForm
                venueId={venue.id}
                venueName={venue.name}
                eventTypes={eventTypes}
              />
            </div>
          </aside>
        </div>

        {/* --- Benzer mekanlar --- */}
        {similar.length > 0 ? (
          <section className="mt-16">
            <h2 className="font-heading text-2xl">
              {venue.city.name}&apos;da benzer mekanlar
            </h2>
            <div className="mt-6">
              <VenueGrid>
                {similar.map((v) => (
                  <VenueCard key={v.id} venue={v} />
                ))}
              </VenueGrid>
            </div>
          </section>
        ) : null}
      </div>

      <StickyInquiryBar
        venueId={venue.id}
        venueName={venue.name}
        startingPrice={venue.starting_price === null ? null : Number(venue.starting_price)}
        priceType={venue.price_type}
        eventTypes={eventTypes}
      />
    </>
  );
}

function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Sayfa yolu">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight className="size-3.5 shrink-0" aria-hidden /> : null}
              {last ? (
                <span aria-current="page" className="truncate text-foreground">
                  {item.name}
                </span>
              ) : (
                <Link href={item.path} className="transition-colors hover:text-foreground">
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 font-heading text-xl sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="tabular mt-1 pl-7 text-sm font-medium">{value ?? "Belirtilmemiş"}</dd>
    </div>
  );
}

function FeatureList({
  items,
}: {
  items: { slug: string; name: string; icon: string | null; note: string | null }[];
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((f) => (
        <li key={f.slug} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 text-muted-foreground">
            <Icon name={f.icon} className="size-4" />
          </span>
          <span>
            {f.name}
            {f.note ? (
              <span className="block text-xs text-muted-foreground">{f.note}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
