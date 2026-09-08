import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewVenueForm } from "@/components/venue-editor/new-venue-form";
import { getCities } from "@/lib/services/taxonomy";

export const metadata: Metadata = {
  title: "Yeni Mekan",
  robots: { index: false, follow: false },
};

export default async function NewVenuePage() {
  const cities = await getCities();

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <Link
        href="/panel/mekanlarim"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mekanlarım
      </Link>

      <div className="max-w-lg">
        <h1 className="font-heading text-2xl sm:text-3xl">Yeni mekan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Şimdilik sadece adı ve konumu yeterli. Fotoğraf, fiyat ve hizmetleri
          sonraki adımlarda ekleyeceksiniz.
        </p>

        <div className="mt-8">
          <NewVenueForm cities={cities} />
        </div>
      </div>
    </div>
  );
}
