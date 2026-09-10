import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageRow } from "@/components/admin/seo-page-row";
import { SeoRefreshButton } from "@/components/admin/seo-refresh-button";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { EmptyState } from "@/components/shared/states";
import { listAdminSeoPages } from "@/lib/services/admin";
import { SEO_MIN_VENUE_COUNT } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "SEO Sayfaları",
  robots: { index: false, follow: false },
};

const SAYFA_BOYU = 50;

const TIPLER = [
  { value: "TUMU", label: "Tümü" },
  { value: "etkinlik", label: "Etkinlik" },
  { value: "sehir", label: "Şehir" },
  { value: "sehir_etkinlik", label: "Şehir × Etkinlik" },
  { value: "ilce_etkinlik", label: "İlçe × Etkinlik" },
];

export default async function AdminSeoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tek = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const tipHam = tek("tip");
  const tip = TIPLER.some((t) => t.value === tipHam && t.value !== "TUMU")
    ? tipHam
    : undefined;
  const durumHam = tek("durum");
  const active = durumHam === "aktif" ? true : durumHam === "pasif" ? false : undefined;
  const q = tek("q")?.trim() || undefined;
  const sayfa = Math.max(1, Number.parseInt(tek("sayfa") ?? "1", 10) || 1);

  const { items, total } = await listAdminSeoPages({
    kind: tip,
    active,
    query: q,
    offset: (sayfa - 1) * SAYFA_BOYU,
  });
  const pageCount = Math.max(1, Math.ceil(total / SAYFA_BOYU));

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const koy = (k: string, v: string | undefined) => {
      if (v) p.set(k, v);
    };
    koy("tip", patch.tip ?? tipHam);
    koy("durum", patch.durum ?? durumHam);
    koy("q", patch.q ?? q);
    koy("sayfa", patch.sayfa);
    const s = p.toString();
    return s ? `/yonetim/seo?${s}` : "/yonetim/seo";
  };

  const aktifSayisi = items.filter((i) => i.is_active).length;

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl">SEO Sayfaları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(total)} sayfa · bu sayfada {aktifSayisi} tanesi indeksleniyor
          </p>
        </div>
        <SeoRefreshButton esik={SEO_MIN_VENUE_COUNT} />
      </header>

      <div className="mb-6 rounded-xl border border-sage-300/60 bg-sage-50/60 p-4 text-sm">
        <p className="font-medium">İndeksleme eşiği neden var?</p>
        <p className="mt-1 text-muted-foreground">
          Yeterli mekanı olmayan sayfa 200 döner ama <code>noindex</code> alır ve
          sitemap&apos;e girmez. 81 il × 9 etkinlik × ilçeler = binlerce boş sayfa
          üretip Google&apos;a &quot;thin content&quot; sinyali vermemek için.
          Mekan sayısı eşiği geçince sayfa kendiliğinden açılır.
        </p>
      </div>

      <nav aria-label="Tipe göre filtrele" className="mb-3 flex flex-wrap gap-1.5">
        {TIPLER.map((t) => {
          const aktif = t.value === "TUMU" ? !tip : tipHam === t.value;
          return (
            <Link
              key={t.value}
              href={href({ tip: t.value === "TUMU" ? undefined : t.value, sayfa: undefined })}
              aria-current={aktif ? "true" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                aktif
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Duruma göre filtrele" className="mb-6 flex flex-wrap gap-1.5">
        {[
          { v: undefined, l: "Hepsi" },
          { v: "aktif", l: "İndekslenenler" },
          { v: "pasif", l: "Eşik altındakiler" },
        ].map((d) => {
          const aktif = (durumHam ?? undefined) === d.v;
          return (
            <Link
              key={d.l}
              href={href({ durum: d.v, sayfa: undefined })}
              aria-current={aktif ? "true" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                aktif
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {d.l}
            </Link>
          );
        })}
      </nav>

      <form action="/yonetim/seo" className="mb-6 flex max-w-md gap-2">
        {tipHam ? <input type="hidden" name="tip" value={tipHam} /> : null}
        {durumHam ? <input type="hidden" name="durum" value={durumHam} /> : null}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Yolda ara (örn. istanbul)…"
          aria-label="SEO sayfası ara"
          className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          className="h-10 rounded-lg border px-4 text-sm transition-colors hover:bg-muted"
        >
          Ara
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Sayfa bulunamadı"
          description="Filtreleri temizleyin veya sayfaları yeniden üretin."
          action={{ label: "Filtreleri temizle", href: "/yonetim/seo" }}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((p) => (
              <li key={p.id}>
                <SeoPageRow page={p} />
              </li>
            ))}
          </ul>
          <div className="pt-8">
            <PaginationNav
              page={sayfa}
              pageCount={pageCount}
              hrefFor={(p) => href({ sayfa: p > 1 ? String(p) : undefined })}
            />
          </div>
        </>
      )}
    </div>
  );
}
