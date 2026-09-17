import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BulkImportForm } from "@/components/admin/bulk-import-form";
import { getCities } from "@/lib/services/taxonomy";

export const metadata: Metadata = {
  title: "Toplu katalog girişi",
  robots: { index: false, follow: false },
};

export default async function AdminBulkImportPage() {
  const cities = await getCities();

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
        <h1 className="font-heading text-2xl sm:text-3xl">Toplu katalog girişi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bir ilçedeki işletmeleri tek seferde açın. Google Maps bağlantılarını
          yapıştırmanız yeterli — ad ve konum bağlantıdan okunur.
        </p>
      </header>

      <div className="mb-6 max-w-2xl rounded-xl border border-sage-300/60 bg-sage-50/60 p-4 text-sm">
        <p className="font-medium">Önce önizleme, sonra ekleme</p>
        <p className="mt-1 text-muted-foreground">
          Önizleme hiçbir şey yazmaz: satırları çözer, katalogda benzer kayıt
          olup olmadığına bakar ve size gösterir. Ne ekleneceğine satır satır
          siz karar verirsiniz. Kayıtlar <strong>sahipsiz ve taslak</strong>{" "}
          açılır; kapasite, hizmet ve fotoğraflar sonra eklenir.
        </p>
      </div>

      <BulkImportForm cities={cities} />
    </div>
  );
}
