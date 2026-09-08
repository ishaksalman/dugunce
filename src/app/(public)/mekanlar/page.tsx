import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ActiveFilterChips, FilterDrawer, FilterSidebar, SortSelect,
} from "@/components/search/filter-controls";
import { VenueCard, VenueCardSkeleton, VenueGrid } from "@/components/venue/venue-card";
import { EmptyState } from "@/components/shared/states";
import { PaginationNav } from "@/components/shared/pagination-nav";
import {
  PAGE_SIZE, filtersToQuery, parseFilters, shouldIndex, type VenueFilters,
} from "@/lib/schemas/filters";
import { searchVenues } from "@/lib/services/venues";
import {
  getCities, getEventTypes, getFilterFeatureGroups, getVenueTypes,
} from "@/lib/services/taxonomy";
import { formatNumber } from "@/lib/format";

export async function generateMetadata({ searchParams }: PageProps<"/mekanlar">): Promise<Metadata> {
  const filters = parseFilters(await searchParams);
  const indexable = shouldIndex(filters);
  return {
    title: "Davet Mekanları — Filtrele ve Karşılaştır",
    description:
      "Şehir, etkinlik türü, kapasite, fiyat ve hizmetlere göre filtreleyerek Türkiye'deki davet mekanlarını karşılaştır.",
    alternates: { canonical: "/mekanlar" },
    // Filtreli kombinasyonlar indekslenmiyor: sonsuz permütasyon duplicate
    // content üretir. Kanonik her zaman temiz /mekanlar sayfası.
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function VenueListPage({ searchParams }: PageProps<"/mekanlar">) {
  const filters = parseFilters(await searchParams);

  const [cities, eventTypes, venueTypes, featureGroups] = await Promise.all([
    getCities(),
    getEventTypes(),
    getVenueTypes(),
    getFilterFeatureGroups(),
  ]);

  const options = {
    cities,
    eventTypes,
    venueTypes,
    featureGroups: featureGroups.map((g) => ({
      name: g.name,
      items: g.items.map((f) => ({ id: f.id, slug: f.slug, name: f.name, icon: f.icon })),
    })),
  };

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="mb-6">
        <h1 className="font-heading text-3xl sm:text-4xl">Davet Mekanları</h1>
        <p className="mt-2 text-muted-foreground">
          Şehir, kapasite, fiyat ve hizmetlere göre filtreleyerek karşılaştır.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8 pr-2">
            <FilterSidebar filters={filters} options={options} />
          </div>
        </aside>

        <div className="min-w-0">
          <Suspense key={JSON.stringify(filters)} fallback={<ResultsSkeleton />}>
            <Results filters={filters} options={options} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Results({
  filters,
  options,
}: {
  filters: VenueFilters;
  options: React.ComponentProps<typeof FilterSidebar>["options"];
}) {
  const { items, total } = await searchVenues(filters);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (page: number) => {
    const qs = filtersToQuery({ ...filters, sayfa: page }).toString();
    return qs ? `/mekanlar?${qs}` : "/mekanlar";
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="tabular font-medium text-foreground">{formatNumber(total)}</span> mekan
          bulundu
        </p>
        <SortSelect filters={filters} />
      </div>

      <div className="mb-6">
        <ActiveFilterChips filters={filters} options={options} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Bu kriterlere uyan mekan bulunamadı"
          description="Filtreleri gevşetmeyi veya farklı bir şehir seçmeyi deneyin."
          action={{ label: "Filtreleri temizle", href: "/mekanlar" }}
        />
      ) : (
        <>
          <VenueGrid>
            {items.map((v, i) => (
              <VenueCard key={v.id} venue={v} priority={i < 3} />
            ))}
          </VenueGrid>
          <div className="pt-10">
            <PaginationNav page={filters.sayfa} pageCount={pageCount} hrefFor={hrefFor} />
          </div>
        </>
      )}

      {/* Mobilde sabit filtre düğmesi. Masaüstünde sol sütun zaten görünür. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-5 lg:hidden">
        <FilterDrawer filters={filters} options={options} total={total} />
      </div>
    </>
  );
}

function ResultsSkeleton() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-56 animate-pulse rounded-lg bg-muted" />
      </div>
      <VenueGrid>
        {Array.from({ length: 6 }, (_, i) => (
          <VenueCardSkeleton key={i} />
        ))}
      </VenueGrid>
    </>
  );
}
