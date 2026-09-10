import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VenueCard, VenueGrid } from "@/components/venue/venue-card";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { getSeoPage, seoBreadcrumbs, seoPageFilters } from "@/lib/services/seo";
import { searchVenues } from "@/lib/services/venues";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { PAGE_SIZE } from "@/lib/schemas/filters";
import { formatNumber } from "@/lib/format";
import { SITE } from "@/lib/constants";

export const revalidate = 3600;

/**
 * Landing sayfasının 2. ve sonraki sayfaları.
 *
 * Ayrı segmentte çünkü `?sayfa=` query param'ı ana sayfayı dinamik yapıyordu
 * ve `generateStaticParams` işlevsiz kalıyordu.
 *
 * Derin sayfalar `noindex, follow` alır: içerikleri 1. sayfayla büyük ölçüde
 * örtüşüyor, ama bağlantıları takip edilsin ki mekan sayfaları taranabilsin.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ landing: string; n: string }>;
}): Promise<Metadata> {
  const { landing, n } = await params;
  const page = await getSeoPage(landing);
  if (!page) return { title: "Sayfa bulunamadı" };

  return {
    title: `${page.h1} — Sayfa ${n}`,
    description: page.meta_description ?? undefined,
    // Kanonik her zaman 1. sayfa; derin sayfalar ayrı bir varlık değil.
    alternates: { canonical: `/${page.path}` },
    robots: { index: false, follow: true },
    openGraph: { url: new URL(`/${page.path}`, SITE.url).toString() },
  };
}

export default async function LandingPagedPage({
  params,
}: {
  params: Promise<{ landing: string; n: string }>;
}) {
  const { landing, n } = await params;
  const sayfa = Number.parseInt(n, 10);

  // /sayfa/1 kanonik adrese yönlendirilir; aynı içeriğin iki adresi olmasın.
  if (!Number.isFinite(sayfa) || sayfa < 2 || sayfa > 500) {
    if (sayfa === 1) redirect(`/${landing}`);
    notFound();
  }

  const page = await getSeoPage(landing);
  if (!page) notFound();

  const { items, total } = await searchVenues(seoPageFilters(page, sayfa));
  if (items.length === 0) notFound();

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const breadcrumbs = seoBreadcrumbs(page);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <div className="container-page py-8 lg:py-12">
        <nav aria-label="Sayfa yolu" className="mb-5 text-sm text-muted-foreground">
          <Link href={`/${page.path}`} className="hover:text-foreground hover:underline">
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
          <PaginationNav
            page={sayfa}
            pageCount={pageCount}
            hrefFor={(p) => (p > 1 ? `/${page.path}/sayfa/${p}` : `/${page.path}`)}
          />
        </div>
      </div>
    </>
  );
}
