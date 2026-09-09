import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { EmptyState } from "@/components/shared/states";
import { ReviewActions } from "@/components/admin/review-actions";
import { ADMIN_PAGE_SIZE, listAdminReviews } from "@/lib/services/admin";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReviewStatus } from "@/types/db";

export const metadata: Metadata = {
  title: "Yorumlar",
  robots: { index: false, follow: false },
};

const DURUMLAR: { value: ReviewStatus | "TUMU"; label: string }[] = [
  { value: "TUMU", label: "Tümü" },
  { value: "PENDING", label: "Bekleyen" },
  { value: "APPROVED", label: "Yayında" },
  { value: "REJECTED", label: "Reddedilen" },
];

const ETIKET: Record<ReviewStatus, { label: string; className: string }> = {
  PENDING: { label: "Bekliyor", className: "bg-warning/15 text-warning-foreground" },
  APPROVED: { label: "Yayında", className: "bg-success/15 text-success" },
  REJECTED: { label: "Reddedildi", className: "bg-destructive/10 text-destructive" },
};

export default async function AdminReviewsPage({
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
    ? (durumHam as ReviewStatus)
    : undefined;
  const sayfa = Math.max(1, Number.parseInt(tek("sayfa") ?? "1", 10) || 1);

  const { items, total } = await listAdminReviews({
    status: durum,
    offset: (sayfa - 1) * ADMIN_PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (patch.durum ?? durumHam) p.set("durum", patch.durum ?? durumHam!);
    if (patch.sayfa) p.set("sayfa", patch.sayfa);
    const s = p.toString();
    return s ? `/yonetim/yorumlar?${s}` : "/yonetim/yorumlar";
  };

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl">Yorumlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNumber(total)} yorum
        </p>
      </header>

      <nav aria-label="Duruma göre filtrele" className="mb-6 flex flex-wrap gap-1.5">
        {DURUMLAR.map((d) => {
          const aktif = d.value === "TUMU" ? !durum : durumHam === d.value;
          return (
            <Link
              key={d.value}
              href={href({ durum: d.value === "TUMU" ? undefined : d.value, sayfa: undefined })}
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
      </nav>

      {items.length === 0 ? (
        <EmptyState
          title="Yorum yok"
          description="Bu filtreye uyan yorum bulunamadı."
          action={{ label: "Tümünü göster", href: "/yonetim/yorumlar" }}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((r) => (
              <li key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.venue_name}</p>
                    <p className="tabular mt-0.5 text-xs text-muted-foreground">
                      {r.author_name} · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="size-3.5 fill-foreground text-foreground" aria-hidden />
                      <span className="tabular font-medium">{r.rating}</span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium",
                        ETIKET[r.status].className,
                      )}
                    >
                      {ETIKET[r.status].label}
                    </span>
                  </div>
                </div>

                {r.title ? <p className="mt-3 text-sm font-medium">{r.title}</p> : null}
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {r.body}
                </p>

                {r.admin_note ? (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Yönetim notu: {r.admin_note}
                  </p>
                ) : null}

                <div className="mt-4">
                  <ReviewActions reviewId={r.id} status={r.status} />
                </div>
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
