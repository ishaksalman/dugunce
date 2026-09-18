import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import { ButtonLink } from "@/components/shared/button-link";
import { EmptyState } from "@/components/shared/states";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { listImportItems } from "@/lib/services/admin";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ImportStatus } from "@/types/db";

export const metadata: Metadata = {
  title: "İçe aktarma günlüğü",
  robots: { index: false, follow: false },
};

const SAYFA_BOYU = 50;

const DURUM: Record<ImportStatus, { label: string; cls: string }> = {
  imported: { label: "Aktarıldı", cls: "bg-success/15 text-success" },
  partial: { label: "Kısmi", cls: "bg-warning/15 text-warning-foreground" },
  duplicate: { label: "Mükerrer", cls: "bg-muted text-muted-foreground" },
  needs_review: { label: "İnceleme gerek", cls: "bg-warning/15 text-warning-foreground" },
  failed: { label: "Başarısız", cls: "bg-destructive/10 text-destructive" },
};

const FILTRELER: { value: ImportStatus | "TUMU"; label: string }[] = [
  { value: "TUMU", label: "Tümü" },
  { value: "imported", label: "Aktarılan" },
  { value: "partial", label: "Kısmi" },
  { value: "needs_review", label: "İnceleme gerek" },
  { value: "duplicate", label: "Mükerrer" },
  { value: "failed", label: "Başarısız" },
];

export default async function ImportLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tek = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const durumHam = tek("durum") ?? "TUMU";
  const durum: ImportStatus | null =
    durumHam !== "TUMU" && FILTRELER.some((f) => f.value === durumHam)
      ? (durumHam as ImportStatus)
      : null;
  const sayfa = Math.max(1, Number.parseInt(tek("sayfa") ?? "1", 10) || 1);

  const { items, total } = await listImportItems(null, durum, (sayfa - 1) * SAYFA_BOYU);
  const pageCount = Math.max(1, Math.ceil(total / SAYFA_BOYU));

  const href = (patch: { durum?: string; sayfa?: string }) => {
    const p = new URLSearchParams();
    const d = patch.durum ?? durumHam;
    if (d && d !== "TUMU") p.set("durum", d);
    if (patch.sayfa) p.set("sayfa", patch.sayfa);
    const s = p.toString();
    return s ? `/yonetim/ice-aktarma?${s}` : "/yonetim/ice-aktarma";
  };

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl">İçe aktarma günlüğü</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(total)} kayıt
          </p>
        </div>
        <ButtonLink href="/yonetim/ice-aktarma/yeni" size="lg" className="h-10 gap-1.5">
          <Play className="size-4" aria-hidden />
          Aktarım çalıştır
        </ButtonLink>
      </header>

      <div className="mb-6 rounded-xl border border-sage-300/60 bg-sage-50/60 p-4 text-sm">
        <p className="font-medium">Kısmi ne demek?</p>
        <p className="mt-1 text-muted-foreground">
          Görsel hatası işletmeyi düşürmüyor: 8 görselin 2&apos;si indiyse kayıt
          açılıyor ve durum <strong>kısmi</strong> oluyor. Hiçbiri inmediyse
          <strong> inceleme gerek</strong> — kayıt duruyor ama galerisi boş.
        </p>
      </div>

      <nav aria-label="Duruma göre filtrele" className="mb-6 flex flex-wrap gap-1.5">
        {FILTRELER.map((f) => {
          const aktif = durumHam === f.value;
          return (
            <Link
              key={f.value}
              href={href({ durum: f.value, sayfa: undefined })}
              aria-current={aktif ? "true" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                aktif
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          title="Günlük boş"
          description="İçe aktarma çalıştırıldığında her kaydın sonucu burada listelenir."
        />
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="rounded-xl border bg-card p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {i.venue_id && i.venue_slug ? (
                        <Link
                          href={`/yonetim/mekanlar/${i.venue_id}`}
                          className="hover:underline"
                        >
                          {i.name ?? "(adsız)"}
                        </Link>
                      ) : (
                        (i.name ?? "(adsız)")
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{i.source}</span>
                      <span className="tabular">{formatDate(i.created_at)}</span>
                      {i.image_total > 0 ? (
                        <span className="tabular">
                          görsel {i.image_ok}/{i.image_total}
                          {i.image_failed > 0 ? ` · ${i.image_failed} düştü` : ""}
                        </span>
                      ) : null}
                    </p>
                    {i.source_url ? (
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {i.source_url}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium",
                      DURUM[i.status].cls,
                    )}
                  >
                    {DURUM[i.status].label}
                  </span>
                </div>

                {i.error ? (
                  <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                    {i.error}
                  </p>
                ) : null}
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
