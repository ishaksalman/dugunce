import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { VenueCard, VenueGrid } from "@/components/venue/venue-card";
import { EmptyState } from "@/components/shared/states";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { getSeoPage, listActiveSeoPages, seoBreadcrumbs, seoPageFilters } from "@/lib/services/seo";
import { searchVenues } from "@/lib/services/venues";
import { getCities } from "@/lib/services/taxonomy";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { itemListJsonLd, faqJsonLd } from "@/lib/seo/landing-jsonld";
import { landingHref, landingPath, parseLandingSegments } from "@/lib/seo/paths";
import { PAGE_SIZE } from "@/lib/schemas/filters";
import { formatNumber } from "@/lib/format";
import { SITE } from "@/lib/constants";

// Landing sayfaları SEO yüzeyimiz: statik üretilip saatlik tazeleniyor.
export const revalidate = 3600;

/**
 * En çok aranan sayfaları build sırasında üret; kalanlar ilk istekte
 * üretilip önbelleğe alınır. Hepsini üretmek build süresini gereksiz uzatır.
 *
 * Sayfalama (`/…/sayfa/2`) burada ÜRETİLMİYOR: `noindex` alıyor ve ilk
 * istekte üretilip önbelleğe giriyor, build'i uzatmasına gerek yok.
 */
export async function generateStaticParams() {
  const pages = await listActiveSeoPages();
  return pages
    .filter((p) => p.kind === "etkinlik" || p.kind === "sehir_etkinlik")
    .slice(0, 200)
    .map((p) => ({ landing: p.path.split("/") }));
}

type Params = { params: Promise<{ landing: string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { landing } = await params;
  const { path, sayfa } = parseLandingSegments(landing);
  const page = await getSeoPage(path);
  if (!page || sayfa === null) return { title: "Sayfa bulunamadı" };

  const kanonik = landingHref(page.path);

  // Derin sayfalar ayrı bir varlık değil: kanonik her zaman 1. sayfa,
  // kendileri `noindex, follow` — bağlantıları takip edilsin ki mekan
  // sayfaları taranabilsin.
  if (sayfa > 1) {
    return {
      title: `${page.h1} — Sayfa ${sayfa}`,
      description: page.meta_description ?? undefined,
      alternates: { canonical: kanonik },
      robots: { index: false, follow: true },
      openGraph: { url: new URL(kanonik, SITE.url).toString() },
    };
  }

  return {
    title: page.title,
    description: page.meta_description ?? undefined,
    alternates: { canonical: kanonik },
    // Eşik altındaki sayfa 200 döner ama indekslenmez — thin content
    // koruması. Kullanıcı gelmişse boş sayfa değil, yakın alternatif görür.
    robots: page.is_active
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      title: page.title,
      description: page.meta_description ?? undefined,
      url: new URL(kanonik, SITE.url).toString(),
    },
  };
}

/**
 * DİKKAT: bu sayfa `searchParams` KULLANMAZ. Kullansaydı Next rotayı dinamik
 * sayar ve `generateStaticParams` işlevsiz kalırdı — ana SEO yüzeyimiz her
 * istekte sunucuda render edilirdi. Sayfalama adresin parçası:
 * `/istanbul/dugun-mekanlari/sayfa/2`.
 *
 * Sayfalamanın catch-all'ın içinde çözülmesinin sebebi Next'in kısıtı:
 * catch-all segmentinden sonra rota tanımlanamıyor.
 */
export default async function LandingPage({ params }: Params) {
  const { landing } = await params;
  const { path, sayfa, acik } = parseLandingSegments(landing);
  if (sayfa === null) notFound();

  // `/…/sayfa/1` kanonik adrese gider; aynı içeriğin iki adresi olmasın.
  if (acik && sayfa === 1) redirect(`/${path}`);

  const page = await getSeoPage(path);
  if (!page) notFound();

  const { items, total } = await searchVenues(seoPageFilters(page, sayfa));
  // Var olmayan derin sayfa: boş liste göstermek yerine 404.
  if (sayfa > 1 && items.length === 0) notFound();

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const breadcrumbs = seoBreadcrumbs(page);
  const hrefFor = (p: number) => landingHref(page.path, p);

  if (sayfa > 1) {
    return (
      <>
        <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
        <div className="container-page py-8 lg:py-12">
          <nav aria-label="Sayfa yolu" className="mb-5 text-sm text-muted-foreground">
            <Link href={hrefFor(1)} className="hover:text-foreground hover:underline">
              {page.h1}
            </Link>
            <span aria-current="page"> · Sayfa {sayfa}</span>
          </nav>

          <header className="mb-8">
            <h1 className="font-heading text-2xl sm:text-3xl">
              {page.h1} — Sayfa {sayfa}
            </h1>
            <p className="tabular mt-2 text-sm text-muted-foreground">
              Toplam {formatNumber(total)} mekan
            </p>
          </header>

          <VenueGrid>
            {items.map((v) => (
              <VenueCard key={v.id} venue={v} />
            ))}
          </VenueGrid>

          <div className="pt-10">
            <PaginationNav page={sayfa} pageCount={pageCount} hrefFor={hrefFor} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      {page.is_active && items.length > 0 ? (
        <JsonLd data={itemListJsonLd(page, items)} />
      ) : null}
      {page.faq.length > 0 ? <JsonLd data={faqJsonLd(page)} /> : null}

      <div className="container-page py-8 lg:py-12">
        <nav aria-label="Sayfa yolu" className="mb-5">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((item, i) => {
              const son = i === breadcrumbs.length - 1;
              return (
                <li key={item.path} className="flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="size-3.5 shrink-0" aria-hidden /> : null}
                  {son ? (
                    <span aria-current="page" className="text-foreground">{item.name}</span>
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

        <header className="mb-8 max-w-3xl">
          <h1 className="font-heading text-3xl sm:text-4xl">{page.h1}</h1>
          {page.meta_description ? (
            <p className="mt-3 text-lg text-muted-foreground">{page.meta_description}</p>
          ) : null}
          <p className="tabular mt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{formatNumber(total)}</span> mekan
            listeleniyor
          </p>
        </header>

        {page.intro_html ? (
          <div
            className="prose-tr mb-10 max-w-3xl text-muted-foreground"
            // İçerik yalnızca yöneticinin girdiği metin; kullanıcı girdisi değil.
            dangerouslySetInnerHTML={{ __html: page.intro_html }}
          />
        ) : null}

        {items.length === 0 ? (
          <YakinAlternatifler page={page} />
        ) : (
          <>
            <VenueGrid>
              {items.map((v, i) => (
                <VenueCard key={v.id} venue={v} priority={i < 3} />
              ))}
            </VenueGrid>
            <div className="pt-10">
              <PaginationNav page={sayfa} pageCount={pageCount} hrefFor={hrefFor} />
            </div>
          </>
        )}

        {page.faq.length > 0 ? (
          <section className="mt-16 max-w-3xl">
            <h2 className="mb-6 font-heading text-2xl">Sık sorulan sorular</h2>
            <dl className="space-y-6">
              {page.faq.map((f, i) => (
                <div key={i}>
                  <dt className="font-medium">{f.soru}</dt>
                  <dd className="mt-1.5 leading-relaxed text-muted-foreground">{f.cevap}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <IlgiliSayfalar page={page} />
      </div>
    </>
  );
}

/** Sonuç yoksa kullanıcıyı boş sayfayla baş başa bırakmıyoruz. */
async function YakinAlternatifler({
  page,
}: {
  page: { city_slug: string | null; event_slug: string | null; event_name: string | null };
}) {
  const cities = await getCities(true);
  return (
    <div className="space-y-8">
      <EmptyState
        title="Bu kriterlere uyan mekan bulunamadı"
        description="Yakındaki şehirlere bakabilir veya tüm mekanları inceleyebilirsiniz."
        action={{ label: "Tüm mekanlar", href: "/mekanlar" }}
      />
      <div>
        <h2 className="mb-3 text-sm font-medium">Popüler şehirlerde bakın</h2>
        <ul className="flex flex-wrap gap-2">
          {cities.map((c) => (
            <li key={c.id}>
              <Link
                href={landingHref(
                  landingPath({ citySlug: c.slug, eventSlug: page.event_slug }),
                )}
                className="inline-block rounded-full border px-3.5 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** İç bağlantı: aynı şehirdeki diğer etkinlikler, aynı etkinlikteki diğer şehirler. */
async function IlgiliSayfalar({
  page,
}: {
  page: {
    path: string;
    city_slug: string | null;
    city_name: string | null;
    event_slug: string | null;
    event_name: string | null;
  };
}) {
  const aktif = await listActiveSeoPages();

  // İç içe yol sayesinde şehrin sayfaları ön ekten değil, şehir slug'ından
  // bulunuyor — eskiden `path.startsWith("istanbul-")` diye string'e
  // bakılıyordu ve "istanbul-" ile başlayan başka bir şehir olsa kırılırdı.
  const ayniSehir = page.city_slug
    ? aktif
        .filter(
          (p) =>
            p.kind === "sehir_etkinlik" &&
            p.city_slug === page.city_slug &&
            p.path !== page.path,
        )
        .slice(0, 8)
    : [];

  const ayniEtkinlik = page.event_slug
    ? aktif
        .filter(
          (p) =>
            p.kind === "sehir_etkinlik" &&
            p.event_slug === page.event_slug &&
            p.path !== page.path,
        )
        .slice(0, 8)
    : [];

  if (ayniSehir.length === 0 && ayniEtkinlik.length === 0) return null;

  return (
    <section className="mt-16 border-t pt-10">
      <div className="grid gap-8 sm:grid-cols-2">
        {ayniSehir.length > 0 ? (
          <div>
            <h2 className="mb-3 text-sm font-medium">
              {page.city_name} için diğer etkinlikler
            </h2>
            <ul className="space-y-1.5">
              {ayniSehir.map((p) => (
                <li key={p.path}>
                  <Link
                    href={landingHref(p.path)}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {p.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {ayniEtkinlik.length > 0 ? (
          <div>
            <h2 className="mb-3 text-sm font-medium">
              Diğer şehirlerde {page.event_name?.toLocaleLowerCase("tr")} mekanları
            </h2>
            <ul className="space-y-1.5">
              {ayniEtkinlik.map((p) => (
                <li key={p.path}>
                  <Link
                    href={landingHref(p.path)}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {p.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
