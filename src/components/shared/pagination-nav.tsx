import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sunucu tarafında render edilen sayfalama. Gerçek `<a>` bağlantıları
 * kullanılıyor: arama motoru derin sayfaları takip edebilsin, kullanıcı
 * yeni sekmede açabilsin.
 */
export function PaginationNav({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const pages = pageWindow(page, pageCount);

  return (
    <nav aria-label="Sayfalama" className="flex items-center justify-center gap-1 pt-4">
      <PageLink
        href={hrefFor(page - 1)}
        disabled={page <= 1}
        aria-label="Önceki sayfa"
        icon
      >
        <ChevronLeft className="size-4" aria-hidden />
      </PageLink>

      {pages.map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-2 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <PageLink
            key={p}
            href={hrefFor(p)}
            active={p === page}
            aria-label={`Sayfa ${p}`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </PageLink>
        ),
      )}

      <PageLink
        href={hrefFor(page + 1)}
        disabled={page >= pageCount}
        aria-label="Sonraki sayfa"
        icon
      >
        <ChevronRight className="size-4" aria-hidden />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  icon,
  children,
  ...rest
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  icon?: boolean;
  children: React.ReactNode;
} & React.ComponentProps<"a">) {
  const className = cn(
    "inline-flex h-9 items-center justify-center rounded-md border text-sm transition-colors tabular",
    icon ? "w-9" : "min-w-9 px-3",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-transparent hover:bg-muted",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) {
    return (
      <span className={className} aria-disabled {...rest}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

/** 1 … 4 [5] 6 … 20 biçiminde kısaltılmış sayfa listesi. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | null)[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push(null);
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pageCount - 1) out.push(null);
  out.push(pageCount);
  return out;
}
