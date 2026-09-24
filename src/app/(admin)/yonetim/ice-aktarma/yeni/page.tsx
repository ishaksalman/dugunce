import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportRunner } from "@/components/admin/import-runner";
import { getCities, getVenueTypes } from "@/lib/services/taxonomy";

export const metadata: Metadata = {
  title: "İçe aktarım çalıştır",
  robots: { index: false, follow: false },
};

export default async function ImportRunPage() {
  const [cities, venueTypes] = await Promise.all([getCities(), getVenueTypes()]);

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <Link
        href="/yonetim/ice-aktarma"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        İçe aktarma günlüğü
      </Link>

      <header className="mb-6 max-w-2xl">
        <h1 className="font-heading text-2xl sm:text-3xl">İçe aktarım çalıştır</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          İşletme bilgilerini ve görsel adreslerini verin; kayıtlar açılır,
          görseller indirilip galeriye eklenir, sonuç günlüğe yazılır.
        </p>
      </header>

      <div className="mb-6 max-w-2xl rounded-xl border border-sage-300/60 bg-sage-50/60 p-4 text-sm">
        <p className="font-medium">Kaynağın hakkı sizde olmalı</p>
        <p className="mt-1 text-muted-foreground">
          Bu ekran verdiğiniz adresteki görselleri indirip{" "}
          <strong>bizim sunucumuzda yayınlar</strong>. Yalnızca yayınlama
          hakkına sahip olduğunuz kaynakları verin: işletmenin size gönderdiği
          galeri, tamamlama bağlantısından yüklenenler ya da izni alınmış
          site. Sistem kaynağın meşruluğunu denetleyemez.
        </p>
      </div>

      <div className="mb-6 max-w-2xl rounded-xl border p-4 text-sm">
        <p className="font-medium">Nasıl çalışır</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>
            · Kayıtlar <strong>sahipsiz ve taslak</strong> açılır; mükerrer
            kontrolü (kaynak adresi, place_id, ad+ilçe, telefon, web sitesi)
            uygulanır.
          </li>
          <li>
            · Görsellerden ilki <strong>kapak</strong> olur. Bozuk, çok küçük
            ve tekrar eden görseller elenir.
          </li>
          <li>
            · Bir görselin düşmesi işletmeyi düşürmez; sonuç{" "}
            <strong>kısmi</strong> olarak işaretlenir.
          </li>
          <li>
            · <strong>Yarıda kalırsa</strong> aynı yükü tekrar verin: daha önce
            işlenmiş kaynak adresleri işaretli gelir ve seçilmez.
          </li>
        </ul>
      </div>

      <ImportRunner cities={cities} venueTypes={venueTypes} />
    </div>
  );
}
