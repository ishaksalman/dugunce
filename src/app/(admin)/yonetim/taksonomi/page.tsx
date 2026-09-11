import type { Metadata } from "next";
import Link from "next/link";
import {
  CitiesSection, EventTypesSection, FeaturesSection, VenueTypesSection,
} from "@/components/admin/taxonomy-sections";
import { getAdminTaxonomy } from "@/lib/services/admin";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Taksonomi",
  robots: { index: false, follow: false },
};

const BOLUMLER = [
  { value: "etkinlik", label: "Etkinlik türleri" },
  { value: "mekan", label: "Mekan türleri" },
  { value: "ozellik", label: "Özellik ve hizmetler" },
  { value: "sehir", label: "Şehirler ve ilçeler" },
] as const;

type Bolum = (typeof BOLUMLER)[number]["value"];

export default async function AdminTaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ham = Array.isArray(sp.bolum) ? sp.bolum[0] : sp.bolum;
  const bolum: Bolum = BOLUMLER.some((b) => b.value === ham) ? (ham as Bolum) : "etkinlik";

  const t = await getAdminTaxonomy();

  const sayilar: Record<Bolum, number> = {
    etkinlik: t.event_types.length,
    mekan: t.venue_types.length,
    ozellik: t.features.length,
    sehir: t.cities.length,
  };

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl">Taksonomi</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Mekanların sınıflandırıldığı listeler. Hepsi veritabanından geliyor;
          burada değiştirdiğiniz her şey filtre panelinde, mekan formunda ve
          vitrinde aynı anda değişir.
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-sage-300/60 bg-sage-50/60 p-4 text-sm">
        <p className="font-medium">Neden silme yok?</p>
        <p className="mt-1 text-muted-foreground">
          Bir etkinlik türünü ya da özelliği silmek, ona bağlanmış mekan
          kayıtlarını da götürür — mekan sahibinin girdiği veri sessizce
          kaybolur. Bunun yerine <strong>pasife alın</strong>: satır vitrinde
          ve formda görünmez, mevcut bağlar durur, karar geri alınabilir.
        </p>
      </div>

      <nav aria-label="Bölümler" className="mb-6 flex flex-wrap gap-1.5">
        {BOLUMLER.map((b) => {
          const aktif = b.value === bolum;
          return (
            <Link
              key={b.value}
              href={b.value === "etkinlik" ? "/yonetim/taksonomi" : `/yonetim/taksonomi?bolum=${b.value}`}
              aria-current={aktif ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                aktif
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {b.label}
              <span className="tabular ml-1.5 opacity-70">{formatNumber(sayilar[b.value])}</span>
            </Link>
          );
        })}
      </nav>

      {bolum === "etkinlik" ? <EventTypesSection items={t.event_types} /> : null}
      {bolum === "mekan" ? <VenueTypesSection items={t.venue_types} /> : null}
      {bolum === "ozellik" ? <FeaturesSection items={t.features} /> : null}
      {bolum === "sehir" ? <CitiesSection items={t.cities} /> : null}
    </div>
  );
}
