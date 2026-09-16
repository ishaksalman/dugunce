import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CatalogVenueForm } from "@/components/admin/catalog-venue-form";
import { getBusinessCategories, getCities, getVenueTypes } from "@/lib/services/taxonomy";

export const metadata: Metadata = {
  title: "Katalog kaydı aç",
  robots: { index: false, follow: false },
};

export default async function AdminNewVenuePage() {
  const [cities, categories, venueTypes] = await Promise.all([
    getCities(),
    getBusinessCategories(),
    getVenueTypes(),
  ]);

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <Link
        href="/yonetim/mekanlar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mekanlar
      </Link>

      <header className="mb-6 max-w-2xl">
        <h1 className="font-heading text-2xl sm:text-3xl">Katalog kaydı aç</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          İşletmenin kimlik bilgilerini girin; kapasite, fiyat ve fotoğraflar
          düzenleme ekranından eklenir.
        </p>
      </header>

      <div className="mb-6 max-w-2xl rounded-xl border border-sage-300/60 bg-sage-50/60 p-4 text-sm">
        <p className="font-medium">Kayıt kimin üstüne açılıyor?</p>
        <p className="mt-1 text-muted-foreground">
          Hiç kimsenin — <strong>sahiplenilmemiş</strong> bir katalog kaydı
          oluyor. Profil yayına alındıktan sonra işletme sahibi kendi sayfasında
          &quot;Profilinizi sahiplenin&quot; diyerek başvuruyor, siz onaylayınca
          sahiplik ona geçiyor.
        </p>
      </div>

      <CatalogVenueForm cities={cities} categories={categories} venueTypes={venueTypes} />
    </div>
  );
}
