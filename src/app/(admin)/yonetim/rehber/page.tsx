import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/shared/button-link";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { EmptyState } from "@/components/shared/states";
import { ADMIN_PAGE_SIZE, listAdminBlogPosts } from "@/lib/services/admin";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BlogPostStatus } from "@/types/db";

export const metadata: Metadata = {
  title: "Rehber",
  robots: { index: false, follow: false },
};

const DURUMLAR: { value: BlogPostStatus | "TUMU"; label: string }[] = [
  { value: "TUMU", label: "Tümü" },
  { value: "PUBLISHED", label: "Yayında" },
  { value: "DRAFT", label: "Taslak" },
];

const DURUM_STIL: Record<BlogPostStatus, string> = {
  PUBLISHED: "bg-success/15 text-success",
  DRAFT: "bg-muted text-muted-foreground",
};

export default async function AdminBlogPage({
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
    ? (durumHam as BlogPostStatus)
    : undefined;
  const sayfa = Math.max(1, Number.parseInt(tek("sayfa") ?? "1", 10) || 1);

  const { items, total } = await listAdminBlogPosts(durum ?? null, (sayfa - 1) * ADMIN_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const href = (patch: { durum?: string; sayfa?: string }) => {
    const p = new URLSearchParams();
    if (patch.durum ?? durumHam) p.set("durum", patch.durum ?? durumHam!);
    const s = patch.sayfa ?? "1";
    if (s !== "1") p.set("sayfa", s);
    const qs = p.toString();
    return qs ? `/yonetim/rehber?${qs}` : "/yonetim/rehber";
  };

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl">Rehber</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SEO için yazılan rehber yazıları — /rehber altında yayınlanır.
          </p>
        </div>
        <ButtonLink href="/yonetim/rehber/yeni" size="lg" className="gap-2">
          <Plus className="size-4" aria-hidden />
          Yeni yazı
        </ButtonLink>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {DURUMLAR.map((d) => {
          const active = (d.value === "TUMU" && !durum) || d.value === durum;
          return (
            <Link
              key={d.value}
              href={href({ durum: d.value === "TUMU" ? undefined : d.value })}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active ? "border-primary bg-secondary font-medium" : "hover:bg-muted",
              )}
            >
              {d.label}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Henüz yazı yok"
          description="İlk rehber yazısını oluşturarak başlayın."
          action={{ label: "Yeni yazı", href: "/yonetim/rehber/yeni" }}
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((post) => (
            <li key={post.id}>
              <Link
                href={`/yonetim/rehber/${post.id}`}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{post.title}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        DURUM_STIL[post.status],
                      )}
                    >
                      {post.status === "PUBLISHED" ? "Yayında" : "Taslak"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    /rehber/{post.slug}
                  </p>
                </div>
                <p className="tabular shrink-0 text-xs text-muted-foreground">
                  {formatDate(post.updated_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <PaginationNav
          page={sayfa}
          pageCount={pageCount}
          hrefFor={(p) => href({ sayfa: String(p) })}
        />
      </div>
    </div>
  );
}
