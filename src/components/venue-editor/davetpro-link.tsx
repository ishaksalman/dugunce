"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Link2, Link2Off, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { linkVenueToDavetPro, unlinkVenueFromDavetPro } from "@/lib/actions/davetpro-link";
import { formatDate, formatNumber } from "@/lib/format";
import type { DavetProStatus } from "@/types/db";

/**
 * DavetPro hesabı bağlama.
 *
 * Akış: mekan sahibi DavetPro'da tek kullanımlık kod üretir, buraya girer.
 * Bağlantı kurulduğu anda o mekanın TÜM geçmiş talepleri DavetPro'ya
 * aktarılmak üzere kuyruğa girer — kullanıcı geçmişini kaybetmesin.
 */
export function DavetProLink({
  venueId,
  durum,
}: {
  venueId: string;
  durum: DavetProStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  if (durum.linked) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-5">
        <h3 className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          DavetPro&apos;ya bağlı
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {durum.linked_at ? `${formatDate(durum.linked_at)} tarihinde bağlandı. ` : ""}
          Bu mekana gelen teklif talepleri DavetPro&apos;daki satış hattınıza
          da düşüyor.
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Aktarılan</dt>
            <dd className="tabular mt-0.5 font-medium">
              {formatNumber(Number(durum.aktarilan))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sırada</dt>
            <dd className="tabular mt-0.5 font-medium">
              {formatNumber(Number(durum.bekleyen))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Başarısız</dt>
            <dd className="tabular mt-0.5 font-medium">
              {formatNumber(Number(durum.basarisiz))}
            </dd>
          </div>
        </dl>

        {Number(durum.basarisiz) > 0 && durum.son_hata ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Bazı talepler aktarılamadı: {durum.son_hata}. Destek ile
              iletişime geçin.
            </span>
          </p>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          className="mt-4 h-9 gap-2"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await unlinkVenueFromDavetPro(venueId);
              if (!r.ok) {
                toast.error(r.message);
                return;
              }
              toast.success("Bağlantı kaldırıldı");
              router.refresh();
            })
          }
        >
          <Link2Off className="size-3.5" aria-hidden />
          Bağlantıyı kaldır
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Bağlantıyı kaldırmak DavetPro&apos;ya daha önce aktarılan talepleri
          silmez; yalnızca yeni talepler gönderilmez.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-5">
      <h3 className="flex items-center gap-2 font-medium">
        <Link2 className="size-4" aria-hidden />
        DavetPro hesabınızı bağlayın
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        DavetPro kullanıyorsanız, bu mekana gelen teklif talepleri oradaki
        satış hattınıza da düşsün.
        {/* Sıfırken cümleyi kurmuyoruz: "0 geçmiş talebiniz de aktarılır"
            kullanıcıya bir şey vadetmiyor, sadece kafa karıştırıyor. */}
        {Number(durum.toplam_talep) > 0 ? (
          <>
            {" "}
            Bağladığınız anda{" "}
            <strong className="text-foreground">
              {formatNumber(Number(durum.toplam_talep))} geçmiş talebiniz
            </strong>{" "}
            de aktarılır.
          </>
        ) : null}
      </p>

      <ol className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        <li>1. DavetPro&apos;da <strong>Ayarlar › DavetMekanı&apos;nda yayınla</strong>&apos;ya girin</li>
        <li>2. Orada üretilen 6 haneli kodu aşağıya yapıştırın</li>
      </ol>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setHata(null);
          startTransition(async () => {
            const r = await linkVenueToDavetPro({ venueId, code: kod });
            if (!r.ok) {
              setHata(r.message);
              return;
            }
            toast.success(`${r.data.businessName} bağlandı`, {
              description:
                r.data.queued > 0
                  ? `${r.data.queued} geçmiş talep aktarılıyor`
                  : "Yeni talepler otomatik aktarılacak",
            });
            setKod("");
            router.refresh();
          });
        }}
      >
        <input
          value={kod}
          onChange={(e) => setKod(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="A7K2M9"
          aria-label="DavetPro bağlama kodu"
          aria-invalid={hata ? true : undefined}
          className={`tabular h-11 w-36 rounded-lg border bg-background px-3 text-center font-mono text-lg tracking-widest outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
            hata ? "border-destructive" : "border-input"
          }`}
        />
        <Button type="submit" size="lg" className="h-11" disabled={pending || kod.length < 6}>
          {pending ? "Bağlanıyor…" : "Bağla"}
        </Button>
      </form>

      {hata ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {hata}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        DavetPro hesabınız yok mu? Mekanınızın rezervasyon, ödeme ve sözleşme
        takibini tek yerden yönetmek isterseniz DavetPro&apos;ya geçebilirsiniz.
      </p>
    </div>
  );
}
