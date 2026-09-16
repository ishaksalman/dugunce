import type { Metadata } from "next";
import Link from "next/link";
import { ClaimRow } from "@/components/admin/claim-row";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { EmptyState } from "@/components/shared/states";
import { listAdminClaims } from "@/lib/services/admin";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClaimStatus } from "@/types/db";

export const metadata: Metadata = {
  title: "Sahiplenme başvuruları",
  robots: { index: false, follow: false },
};

const SAYFA_BOYU = 25;

const DURUMLAR: { value: ClaimStatus | "TUMU"; label: string }[] = [
  { value: "PENDING", label: "Bekleyen" },
  { value: "APPROVED", label: "Onaylanan" },
  { value: "REJECTED", label: "Reddedilen" },
  { value: "TUMU", label: "Tümü" },
];

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tek = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const durumHam = tek("durum") ?? "PENDING";
  const durum: ClaimStatus | null =
    durumHam === "TUMU"
      ? null
      : DURUMLAR.some((d) => d.value === durumHam)
        ? (durumHam as ClaimStatus)
        : "PENDING";
  const sayfa = Math.max(1, Number.parseInt(tek("sayfa") ?? "1", 10) || 1);

  const { items, total } = await listAdminClaims(durum, (sayfa - 1) * SAYFA_BOYU);
  const pageCount = Math.max(1, Math.ceil(total / SAYFA_BOYU));

  const href = (patch: { durum?: string; sayfa?: string }) => {
    const p = new URLSearchParams();
    const d = patch.durum ?? durumHam;
    if (d) p.set("durum", d);
    if (patch.sayfa) p.set("sayfa", patch.sayfa);
    const s = p.toString();
    return s ? `/yonetim/basvurular?${s}` : "/yonetim/basvurular";
  };

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl">Sahiplenme başvuruları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNumber(total)} başvuru
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-sage-300/60 bg-sage-50/60 p-4 text-sm">
        <p className="font-medium">Onaylamadan önce doğrulayın</p>
        <p className="mt-1 text-muted-foreground">
          Onay, profilin sahipliğini başvurana <strong>devreder</strong>: teklif
          taleplerini görür, içeriği değiştirir. Beyanla yetinmeyin — işletmenin
          bilinen numarasını arayın veya kurumsal e-postasından teyit isteyin.
          Rakibin sayfasını ele geçirmenin en kolay yolu burası.
        </p>
      </div>

      <nav aria-label="Duruma göre filtrele" className="mb-6 flex flex-wrap gap-1.5">
        {DURUMLAR.map((d) => {
          const aktif = durumHam === d.value;
          return (
            <Link
              key={d.value}
              href={href({ durum: d.value, sayfa: undefined })}
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
          title="Başvuru yok"
          description="İşletme sahipleri profillerini sahiplendiğinde başvurular burada listelenir."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((c) => (
              <li key={c.id}>
                <ClaimRow claim={c} />
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
