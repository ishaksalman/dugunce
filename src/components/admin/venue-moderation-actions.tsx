"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Pencil, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setVenueFeatured, setVenueStatus } from "@/lib/actions/admin";
import { venueHref } from "@/components/venue/venue-card";
import type { AdminVenue } from "@/types/db";

/**
 * Onay/red/askıya alma. Reddetme ve askıya alma gerekçe ister — mekan
 * sahibi ne düzelteceğini bilmeli. Kural veritabanında da zorlanıyor.
 */
export function VenueModerationActions({ venue }: { venue: AdminVenue }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gerekce, setGerekce] = useState<"REJECTED" | "SUSPENDED" | null>(null);
  const [metin, setMetin] = useState("");

  const calistir = (islem: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await islem();
      if (!r.ok) {
        toast.error(r.message ?? "İşlem tamamlanamadı.");
        return;
      }
      setGerekce(null);
      setMetin("");
      toast.success("Güncellendi");
      router.refresh();
    });

  if (gerekce) {
    return (
      <div className="w-full space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <label htmlFor={`gerekce-${venue.id}`} className="block text-xs font-medium">
          {gerekce === "REJECTED" ? "Red gerekçesi" : "Askıya alma gerekçesi"} — mekan
          sahibine gösterilir
        </label>
        <textarea
          id={`gerekce-${venue.id}`}
          rows={2}
          autoFocus
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          maxLength={1000}
          placeholder="Fotoğraflar mekanı temsil etmiyor, lütfen gerçek fotoğraf ekleyin."
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="h-8"
            disabled={pending || metin.trim().length === 0}
            onClick={() =>
              calistir(() =>
                setVenueStatus({ venueId: venue.id, status: gerekce, reason: metin }),
              )
            }
          >
            {pending ? "Gönderiliyor…" : gerekce === "REJECTED" ? "Reddet" : "Askıya al"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={pending}
            onClick={() => {
              setGerekce(null);
              setMetin("");
            }}
          >
            Vazgeç
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        nativeButton={false}
        render={
          <Link href={`/yonetim/mekanlar/${venue.id}`}>
            İncele
          </Link>
        }
      />

      {/* Katalog kaydının içeriğini yönetim dolduruyor. Sahipsiz mekan
          "Mekanlarım" listesinde ÇIKMIYOR (get_my_venues owner_id'ye
          bakıyor), dolayısıyla düzenleyiciye tek giriş burası. */}
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        nativeButton={false}
        render={
          <Link href={`/panel/mekanlarim/${venue.id}/temel-bilgiler`}>
            <Pencil className="size-3.5" aria-hidden />
            İçeriği düzenle
          </Link>
        }
      />

      {venue.status !== "PUBLISHED" ? (
        <Button
          size="sm"
          className="h-8 gap-1.5"
          disabled={pending}
          onClick={() =>
            calistir(() => setVenueStatus({ venueId: venue.id, status: "PUBLISHED" }))
          }
        >
          <Check className="size-3.5" aria-hidden />
          Yayınla
        </Button>
      ) : null}

      {venue.status === "PENDING_REVIEW" ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          disabled={pending}
          onClick={() => setGerekce("REJECTED")}
        >
          <X className="size-3.5" aria-hidden />
          Reddet
        </Button>
      ) : null}

      {venue.status === "PUBLISHED" ? (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={pending}
            onClick={() =>
              calistir(() =>
                setVenueFeatured({
                  venueId: venue.id,
                  featured: !venue.is_featured,
                  days: 30,
                }),
              )
            }
          >
            <Star
              className={`size-3.5 ${venue.is_featured ? "fill-current" : ""}`}
              aria-hidden
            />
            {venue.is_featured ? "Öne çıkarmayı kaldır" : "Öne çıkar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={pending}
            onClick={() => setGerekce("SUSPENDED")}
          >
            Askıya al
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5"
            nativeButton={false}
            render={
              <Link
                href={venueHref({
                  citySlug: venue.city_slug,
                  districtSlug: venue.district_slug,
                  slug: venue.slug,
                })}
                target="_blank"
              >
                Vitrin
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            }
          />
        </>
      ) : null}
    </>
  );
}
