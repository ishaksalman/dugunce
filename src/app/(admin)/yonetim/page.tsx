import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Building2, Clock, Inbox, TriangleAlert, Users,
} from "lucide-react";
import { getAdminStats, listAdminVenues } from "@/lib/services/admin";
import { AdminVenueRow } from "@/components/admin/venue-row";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Yönetim",
  robots: { index: false, follow: false },
};

export default async function AdminDashboard() {
  const [stats, kuyruk] = await Promise.all([
    getAdminStats(),
    listAdminVenues({ status: "PENDING_REVIEW" }),
  ]);

  const bekleyen = Number(stats.pending_venues);
  const degisiklik = Number(stats.needs_review);

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-8">
        <h1 className="font-heading text-2xl sm:text-3xl">Özet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platformun genel durumu ve bekleyen işler.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          icon={<Clock className="size-4" />}
          label="İnceleme bekleyen"
          value={formatNumber(bekleyen)}
          vurgu={bekleyen > 0}
        />
        <Tile
          icon={<Building2 className="size-4" />}
          label="Yayında"
          value={formatNumber(Number(stats.published))}
        />
        <Tile
          icon={<Inbox className="size-4" />}
          label="Talep (7 gün)"
          value={formatNumber(Number(stats.inquiries_7d))}
          ipucu={`toplam ${formatNumber(Number(stats.inquiries_total))}`}
        />
        <Tile
          icon={<Users className="size-4" />}
          label="Mekan sahibi"
          value={formatNumber(Number(stats.venue_owners))}
          ipucu={`${formatNumber(Number(stats.total_users))} kullanıcı`}
        />
      </dl>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <MiniTile label="Taslak" value={Number(stats.draft)} />
        <MiniTile label="Reddedilen" value={Number(stats.rejected)} />
        <MiniTile label="Askıda" value={Number(stats.suspended)} />
      </div>

      {degisiklik > 0 || Number(stats.pending_reviews) > 0 ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {degisiklik > 0 ? (
            <Uyari
              href="/yonetim/mekanlar?degisiklik=1"
              label={`${degisiklik} yayındaki mekanda değişiklik incelemede`}
            />
          ) : null}
          {Number(stats.pending_reviews) > 0 ? (
            <Uyari
              href="/yonetim/yorumlar?durum=PENDING"
              label={`${stats.pending_reviews} yorum onay bekliyor`}
            />
          ) : null}
        </div>
      ) : null}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl">Onay kuyruğu</h2>
          <Link
            href="/yonetim/mekanlar"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Tüm mekanlar
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        {kuyruk.items.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              İnceleme bekleyen mekan yok. Kuyruk temiz.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {kuyruk.items.map((v) => (
              <li key={v.id}>
                <AdminVenueRow venue={v} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  ipucu,
  vurgu,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ipucu?: string;
  vurgu?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-5 ${
        vurgu ? "border-warning/50 bg-warning/5" : ""
      }`}
    >
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className="tabular mt-2 text-2xl font-medium">{value}</dd>
      {ipucu ? <p className="mt-1 text-xs text-muted-foreground">{ipucu}</p> : null}
    </div>
  );
}

function MiniTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="tabular font-medium">{formatNumber(value)}</span>
    </div>
  );
}

function Uyari({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-4 py-2.5 text-sm transition-colors hover:bg-warning/10"
    >
      <TriangleAlert className="size-4 text-warning" aria-hidden />
      {label}
      <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
    </Link>
  );
}
