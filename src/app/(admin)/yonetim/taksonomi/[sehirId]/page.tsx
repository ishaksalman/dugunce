import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DistrictsSection } from "@/components/admin/taxonomy-sections";
import { getAdminTaxonomy, listAdminDistricts } from "@/lib/services/admin";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "İlçeler",
  robots: { index: false, follow: false },
};

export default async function AdminDistrictsPage({
  params,
}: {
  params: Promise<{ sehirId: string }>;
}) {
  const { sehirId } = await params;

  // Şehri ayrı sorgulamıyoruz: taksonomi zaten tek çağrıda geliyor ve
  // 81 satır. Var olmayan id'de notFound.
  const t = await getAdminTaxonomy();
  const city = t.cities.find((c) => c.id === sehirId);
  if (!city) notFound();

  const districts = await listAdminDistricts(sehirId);

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <Link
        href="/yonetim/taksonomi?bolum=sehir"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Şehirler
      </Link>

      <header className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl">{city.name} ilçeleri</h1>
        <p className="tabular mt-1 text-sm text-muted-foreground">
          {formatNumber(districts.length)} ilçe ·{" "}
          {formatNumber(Number(city.venue_count))} yayında mekan
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-sage-300/60 bg-sage-50/60 p-4 text-sm">
        <p className="font-medium">İlçe silinemiyor</p>
        <p className="mt-1 text-muted-foreground">
          Mekanlar ilçeye bağlı; ilçeyi silmek onları da götürür. Yanlış
          yazılmış bir ilçenin adı düzeltilebilir, adresi (slug) değişmez.
        </p>
      </div>

      <DistrictsSection cityId={sehirId} items={districts} />
    </div>
  );
}
