import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/shared/button-link";
import { EmptyState } from "@/components/shared/states";
import { OwnerVenueCard } from "@/components/panel/owner-venue-card";
import { getMyVenues } from "@/lib/services/owner";

export const metadata: Metadata = {
  title: "Mekanlarım",
  robots: { index: false, follow: false },
};

export default async function MyVenuesPage() {
  const venues = await getMyVenues();

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl">Mekanlarım</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {venues.length > 0 ? `${venues.length} mekan` : "Henüz mekanınız yok"}
          </p>
        </div>
        <ButtonLink href="/panel/mekanlarim/yeni" size="lg" className="h-10 gap-2">
          <Plus className="size-4" aria-hidden />
          Yeni mekan
        </ButtonLink>
      </header>

      {venues.length === 0 ? (
        <EmptyState
          title="Henüz mekanınız yok"
          description="İlk mekanınızı oluşturun. Listeleme ücretsiz, komisyon yok."
          action={{ label: "Mekan oluştur", href: "/panel/mekanlarim/yeni" }}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {venues.map((v) => (
            <li key={v.id}>
              <OwnerVenueCard venue={v} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
