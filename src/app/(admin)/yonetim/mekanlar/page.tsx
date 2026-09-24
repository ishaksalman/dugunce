import type { Metadata } from "next";
import Link from "next/link";
import { ListPlus, Plus } from "lucide-react";
import { ButtonLink } from "@/components/shared/button-link";
import { VenueBulkList } from "@/components/admin/venue-bulk-list";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { EmptyState } from "@/components/shared/states";
import { ADMIN_PAGE_SIZE, listAdminVenues } from "@/lib/services/admin";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VenueStatus } from "@/types/db";

export const metadata: Metadata = {
  title: "Mekanlar",
  robots: { index: false, follow: false },
};

const DURUMLAR: { value: VenueStatus | "TUMU"; label: string }[] = [
  { value: "TUMU", label: "Tümü" },
  { value: "PENDING_REVIEW", label: "İncelemede" },
  { value: "PUBLISHED", label: "Yayında" },
  { value: "DRAFT", label: "Taslak" },
  { value: "REJECTED", label: "Reddedilen" },
  { value: "SUSPENDED", label: "Askıda" },
];

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tek = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const durumHam = tek("durum");
  const durum = DURUMLAR.some((d) => d.value === durumHam && d.value !== "TUMU")
    ? (durumHam as VenueStatus)
    : undefined;
  const degisiklik = tek("degisiklik") === "1";
  const q = tek("q")?.trim() || undefined;
  const sayfa = Math.max(1, Number.parseInt(tek("sayfa") ?? "1", 10) || 1);

  const { items, total } = await listAdminVenues({
    status: durum,
    query: q,
    needsReview: degisiklik ? true : undefined,
    offset: (sayfa - 1) * ADMIN_PAGE_SIZE,
  });

  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const koy = (k: string, v: string | undefined) => {
      if (v) p.set(k, v);
    };
    koy("durum", patch.durum ?? durumHam);
    koy("degisiklik", patch.degisiklik ?? (degisiklik ? "1" : undefined));
    koy("q", patch.q ?? q);
    koy("sayfa", patch.sayfa);
    const s = p.toString();
    return s ? `/yonetim/mekanlar?${s}` : "/yonetim/mekanlar";
  };

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl">Mekanlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(total)} mekan
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            href="/yonetim/mekanlar/toplu"
            variant="outline"
            size="lg"
            className="h-10 gap-1.5"
          >
            <ListPlus className="size-4" aria-hidden />
            Toplu giriş
          </ButtonLink>
          <ButtonLink href="/yonetim/mekanlar/yeni" size="lg" className="h-10 gap-1.5">
            <Plus className="size-4" aria-hidden />
            Katalog kaydı aç
          </ButtonLink>
        </div>
      </header>

      <nav aria-label="Duruma göre filtrele" className="mb-4 flex flex-wrap gap-1.5">
        {DURUMLAR.map((d) => {
          const aktif =
            d.value === "TUMU" ? !durum && !degisiklik : durumHam === d.value && !degisiklik;
          return (
            <Link
              key={d.value}
              href={href({
                durum: d.value === "TUMU" ? undefined : d.value,
                degisiklik: undefined,
                sayfa: undefined,
              })}
              aria-current={aktif ? "true" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                aktif
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {d.label}
            </Link>
          );
        })}
        <Link
          href={href({ durum: undefined, degisiklik: "1", sayfa: undefined })}
          aria-current={degisiklik ? "true" : undefined}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
            degisiklik
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted",
          )}
        >
          Değişiklik incelemede
        </Link>
      </nav>

      <form action="/yonetim/mekanlar" className="mb-6 flex max-w-md gap-2">
        {durumHam ? <input type="hidden" name="durum" value={durumHam} /> : null}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Mekan veya sahip adı ara…"
          aria-label="Mekan ara"
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
          title="Bu filtreye uyan mekan yok"
          description="Farklı bir durum seçin veya aramayı temizleyin."
          action={{ label: "Filtreleri temizle", href: "/yonetim/mekanlar" }}
        />
      ) : (
        <>
          <VenueBulkList items={items} />
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
