"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Pencil, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteCatalogVenue, setVenueFeatured, setVenueStatus } from "@/lib/actions/admin";
import { venueHref } from "@/components/venue/venue-card";
import type { AdminVenue } from "@/types/db";

/**
 * Onay/red/askıya alma. Reddetme ve askıya alma gerekçe ister — mekan
 * sahibi ne düzelteceğini bilmeli. Kural veritabanında da zorlanıyor.
 */
const ONE_CIKMA_SURELERI = [7, 30, 90] as const;

export function VenueModerationActions({ venue }: { venue: AdminVenue }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gerekce, setGerekce] = useState<"REJECTED" | "SUSPENDED" | null>(null);
  const [metin, setMetin] = useState("");
  const [silOnay, setSilOnay] = useState(false);
  const [sureSecici, setSureSecici] = useState(false);
  const [gunSayisi, setGunSayisi] = useState<number>(30);

  // `featured_active` SQL'de hesaplanıyor (0043) — Date.now() bileşende
  // saf olmayan bir çağrı olurdu. Buton etiketi bunu yansıtıyor: süresi
  // dolmuşsa "öne çıkar" değil "yenile".
  const suresiDoldu = venue.is_featured && !venue.featured_active;

  const calistir = (islem: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await islem();
      if (!r.ok) {
        toast.error(r.message ?? "İşlem tamamlanamadı.");
        return;
      }
      setGerekce(null);
      setMetin("");
      setSureSecici(false);
      toast.success("Güncellendi");
      router.refresh();
    });

  if (silOnay) {
    return (
      <div className="w-full space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm font-medium text-destructive">
          “{venue.name}” kalıcı olarak silinsin mi?
        </p>
        <p className="text-xs text-muted-foreground">
          Bu kayıt sahiplenilmemiş, hiç yayınlanmamış ve talep/yorum almamış —
          bu yüzden silinebiliyor. İşlem geri alınamaz; denetim izinde kaydı
          kalır.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="h-8"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await deleteCatalogVenue(venue.id);
                if (!r.ok) {
                  toast.error(r.message ?? "Silinemedi.");
                  setSilOnay(false);
                  return;
                }
                toast.success(`${venue.name} silindi`);
                setSilOnay(false);
                router.refresh();
              })
            }
          >
            Kalıcı olarak sil
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={pending}
            onClick={() => setSilOnay(false)}
          >
            Vazgeç
          </Button>
        </div>
      </div>
    );
  }

  if (sureSecici) {
    return (
      <div className="w-full space-y-2 rounded-lg border bg-secondary/30 p-3">
        <p className="text-xs font-medium">Ne kadar süre öne çıksın?</p>
        <div className="flex flex-wrap items-center gap-2">
          {ONE_CIKMA_SURELERI.map((gun) => (
            <button
              key={gun}
              type="button"
              onClick={() => setGunSayisi(gun)}
              className={`h-8 rounded-lg border px-3 text-sm transition-colors ${
                gunSayisi === gun
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {gun} gün
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="h-8"
            disabled={pending}
            onClick={() =>
              calistir(() =>
                setVenueFeatured({ venueId: venue.id, featured: true, days: gunSayisi }),
              )
            }
          >
            {pending ? "Uygulanıyor…" : `${gunSayisi} gün öne çıkar`}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={pending}
            onClick={() => setSureSecici(false)}
          >
            Vazgeç
          </Button>
        </div>
      </div>
    );
  }

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

      {/* Silinebilirlik kararı veritabanında (0035): sahipsiz, hiç
          yayınlanmamış, talep ve yorum yok. Arayüz yalnızca onu yansıtıyor —
          gerçek mekanlar için kural hâlâ "askıya al". */}
      {venue.can_delete ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={pending}
          onClick={() => setSilOnay(true)}
        >
          <Trash2 className="size-3.5" aria-hidden />
          Sil
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
            onClick={() => {
              // Etkin (süresi dolmamış) öne çıkarmayı KALDIRMAK süre
              // sormaya gerek bırakmıyor — tek adımda kapatılıyor. Açmak ya
              // da süresi dolmuşu yenilemek süre seçtiriyor (0043 öncesi
              // sabit 30 gündü, artık süre bitince gerçekten etkisiz
              // oluyor, o yüzden yenileme bilinçli bir seçim olmalı).
              if (venue.is_featured && !suresiDoldu) {
                calistir(() => setVenueFeatured({ venueId: venue.id, featured: false }));
              } else {
                setGunSayisi(30);
                setSureSecici(true);
              }
            }}
          >
            <Star
              className={`size-3.5 ${venue.is_featured && !suresiDoldu ? "fill-current" : ""}`}
              aria-hidden
            />
            {venue.is_featured && !suresiDoldu
              ? "Öne çıkarmayı kaldır"
              : suresiDoldu
                ? "Yenile"
                : "Öne çıkar"}
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
