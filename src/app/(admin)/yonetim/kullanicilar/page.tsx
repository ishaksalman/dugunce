import type { Metadata } from "next";
import Link from "next/link";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { EmptyState } from "@/components/shared/states";
import { ROL_ETIKET, UserActions } from "@/components/admin/user-actions";
import { ADMIN_PAGE_SIZE, listAdminUsers } from "@/lib/services/admin";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/db";

export const metadata: Metadata = {
  title: "Kullanıcılar",
  robots: { index: false, follow: false },
};

const ROLLER: { value: UserRole | "TUMU"; label: string }[] = [
  { value: "TUMU", label: "Tümü" },
  { value: "venue_owner", label: "Mekan sahipleri" },
  { value: "admin", label: "Yöneticiler" },
  { value: "customer", label: "Müşteriler" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, me] = await Promise.all([searchParams, requireRole(["admin"])]);
  const tek = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const rolHam = tek("rol");
  const rol = ROLLER.some((r) => r.value === rolHam && r.value !== "TUMU")
    ? (rolHam as UserRole)
    : undefined;
  const q = tek("q")?.trim() || undefined;
  const sayfa = Math.max(1, Number.parseInt(tek("sayfa") ?? "1", 10) || 1);

  const { items, total } = await listAdminUsers({
    role: rol,
    query: q,
    offset: (sayfa - 1) * ADMIN_PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (patch.rol ?? rolHam) p.set("rol", patch.rol ?? rolHam!);
    if (patch.q ?? q) p.set("q", patch.q ?? q!);
    if (patch.sayfa) p.set("sayfa", patch.sayfa);
    const s = p.toString();
    return s ? `/yonetim/kullanicilar?${s}` : "/yonetim/kullanicilar";
  };

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl">Kullanıcılar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNumber(total)} kullanıcı
        </p>
      </header>

      <nav aria-label="Role göre filtrele" className="mb-4 flex flex-wrap gap-1.5">
        {ROLLER.map((r) => {
          const aktif = r.value === "TUMU" ? !rol : rolHam === r.value;
          return (
            <Link
              key={r.value}
              href={href({ rol: r.value === "TUMU" ? undefined : r.value, sayfa: undefined })}
              aria-current={aktif ? "true" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                aktif
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {r.label}
            </Link>
          );
        })}
      </nav>

      <form action="/yonetim/kullanicilar" className="mb-6 flex max-w-md gap-2">
        {rolHam ? <input type="hidden" name="rol" value={rolHam} /> : null}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Ad veya e-posta ara…"
          aria-label="Kullanıcı ara"
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
          title="Kullanıcı bulunamadı"
          action={{ label: "Filtreleri temizle", href: "/yonetim/kullanicilar" }}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((u) => (
              <li key={u.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {u.full_name}
                      {!u.is_active ? (
                        <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
                          Kapalı
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {u.email ?? "—"}
                      {u.phone ? ` · ${u.phone}` : ""}
                    </p>
                    <p className="tabular mt-1 text-xs text-muted-foreground">
                      {ROL_ETIKET[u.role]} · {formatNumber(Number(u.venue_count))} mekan ·
                      Kayıt {formatDate(u.created_at)}
                    </p>
                  </div>
                  <UserActions
                    userId={u.id}
                    role={u.role}
                    isActive={u.is_active}
                    isSelf={u.id === me.id}
                  />
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
