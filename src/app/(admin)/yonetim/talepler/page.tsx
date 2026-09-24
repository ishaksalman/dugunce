import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Mail, MessageSquare, Phone, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/states";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { InquiryStatusSelect } from "@/components/panel/inquiry-status-select";
import { InquiryNote } from "@/components/panel/inquiry-note";
import {
  INQUIRY_STATUS_LABELS, INQUIRY_STATUS_ORDER, isInquiryStatus,
} from "@/lib/inquiry";
import { INQUIRY_PAGE_SIZE, listAdminInquiries } from "@/lib/services/admin";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminInquiry, InquiryStatus } from "@/types/db";

export const metadata: Metadata = {
  title: "Talepler",
  robots: { index: false, follow: false },
};

function parseStatus(value: string | undefined): InquiryStatus | undefined {
  return isInquiryStatus(value) ? value : undefined;
}

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const flat = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const status = parseStatus(flat("durum"));
  const unclaimedOnly = flat("sahipsiz") === "1";
  const query = flat("q")?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(flat("sayfa") ?? "1", 10) || 1);

  const { items, total, newCount } = await listAdminInquiries({
    status, unclaimedOnly, query, page,
  });

  const pageCount = Math.max(1, Math.ceil(total / INQUIRY_PAGE_SIZE));
  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const put = (k: string, v: string | undefined) => {
      if (v) params.set(k, v);
    };
    put("durum", patch.durum ?? status);
    put("sahipsiz", patch.sahipsiz ?? (unclaimedOnly ? "1" : undefined));
    put("q", patch.q ?? query);
    put("sayfa", patch.sayfa);
    const s = params.toString();
    return s ? `/yonetim/talepler?${s}` : "/yonetim/talepler";
  };

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl">Talepler</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNumber(total)} talep
          {newCount > 0 ? ` · ${formatNumber(newCount)} yeni` : ""}
        </p>
      </header>

      <nav aria-label="Duruma göre filtrele" className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip href={qs({ durum: undefined })} active={!status}>
          Tümü
        </FilterChip>
        {INQUIRY_STATUS_ORDER.map((s) => (
          <FilterChip key={s} href={qs({ durum: s })} active={status === s}>
            {INQUIRY_STATUS_LABELS[s]}
          </FilterChip>
        ))}
      </nav>

      <nav aria-label="Sahiplik durumuna göre filtrele" className="mb-6 flex flex-wrap gap-1.5">
        <FilterChip href={qs({ sahipsiz: undefined })} active={!unclaimedOnly}>
          Tüm mekanlar
        </FilterChip>
        <FilterChip href={qs({ sahipsiz: "1" })} active={unclaimedOnly}>
          Yalnızca sahipsiz mekanlar
        </FilterChip>
      </nav>

      <form action="/yonetim/talepler" className="mb-6 flex max-w-md gap-2">
        {status ? <input type="hidden" name="durum" value={status} /> : null}
        {unclaimedOnly ? <input type="hidden" name="sahipsiz" value="1" /> : null}
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="Ad, telefon veya mekan adı ara…"
          aria-label="Talep ara"
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
          title={
            status || unclaimedOnly || query
              ? "Bu filtreye uyan talep yok"
              : "Henüz talep yok"
          }
          description={
            status || unclaimedOnly || query
              ? "Filtreleri temizleyip tekrar deneyin."
              : "Bir mekana teklif talebi gelince burada listelenir."
          }
          action={
            status || unclaimedOnly || query
              ? { label: "Filtreleri temizle", href: "/yonetim/talepler" }
              : undefined
          }
        />
      ) : (
        <>
          <ul className="space-y-4">
            {items.map((inq) => (
              <li key={inq.id}>
                <AdminInquiryCard inquiry={inq} />
              </li>
            ))}
          </ul>
          <div className="pt-8">
            <PaginationNav
              page={page}
              pageCount={pageCount}
              hrefFor={(p) => qs({ sayfa: p > 1 ? String(p) : undefined })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function AdminInquiryCard({ inquiry }: { inquiry: AdminInquiry }) {
  const yeni = inquiry.status === "NEW";

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-5",
        yeni && "border-primary/40 ring-1 ring-primary/10",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-medium">{inquiry.full_name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular">{formatDate(inquiry.created_at)}</span>
            <span>·</span>
            <Link
              href={`/yonetim/mekanlar/${inquiry.venue_id}`}
              className="font-medium text-foreground hover:underline"
            >
              {inquiry.venue_name}
            </Link>
            {!inquiry.is_claimed ? (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                Sahipsiz
              </span>
            ) : null}
          </p>
        </div>
        <InquiryStatusSelect id={inquiry.id} status={inquiry.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <a
          href={`tel:${inquiry.phone.replace(/\s/g, "")}`}
          className="tabular inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <Phone className="size-3.5" aria-hidden />
          {inquiry.phone}
        </a>
        {inquiry.email ? (
          <a
            href={`mailto:${inquiry.email}`}
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <Mail className="size-3.5" aria-hidden />
            {inquiry.email}
          </a>
        ) : null}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {inquiry.event_type_name ? (
          <Fact icon={<MessageSquare className="size-3.5" />} value={inquiry.event_type_name} />
        ) : null}
        {inquiry.event_date ? (
          <Fact icon={<Calendar className="size-3.5" />} value={formatDate(inquiry.event_date)} />
        ) : null}
        {inquiry.guest_count ? (
          <Fact
            icon={<Users className="size-3.5" />}
            value={`${formatNumber(inquiry.guest_count)} kişi`}
          />
        ) : null}
      </dl>

      {inquiry.message ? (
        <blockquote className="mt-4 rounded-lg bg-muted/60 px-4 py-3 text-sm leading-relaxed">
          {inquiry.message}
        </blockquote>
      ) : null}

      <div className="mt-4 border-t pt-4">
        <InquiryNote id={inquiry.id} note={inquiry.owner_note} />
      </div>
    </article>
  );
}

function Fact({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden>{icon}</span>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
