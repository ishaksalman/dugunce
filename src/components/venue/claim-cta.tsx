"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitVenueClaim } from "@/lib/actions/claim";

/**
 * "Bu işletme size mi ait?" çağrısı.
 *
 * Yalnızca SAHİPLENİLMEMİŞ profillerde çıkıyor (`is_claimed === false`).
 * Sahipliği bu form vermiyor, yalnızca başvuru açıyor — devri yönetim
 * doğruladıktan sonra yapıyor.
 *
 * DİKKAT: oturum durumunu SUNUCUDAN sormuyoruz. Sormak çerez okumak demek,
 * çerez okumak da mekan detayını dinamik yapıp statik üretimi öldürür —
 * burası landing sayfalarıyla birlikte iki SEO yüzeyimizden biri.
 * Oturumsuz kullanıcı formu doldurup gönderince sunucu eylemi giriş
 * sayfasına yönlendiriyor ve dönüşte bu sayfaya geri getiriyor.
 */
export function ClaimCta({
  venueId,
  venueName,
  devam,
}: {
  venueId: string;
  venueName: string;
  devam: string;
}) {
  const [acik, setAcik] = useState(false);
  const [gonderildi, setGonderildi] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (gonderildi) {
    return (
      <section className="rounded-xl border border-success/30 bg-success/5 p-5">
        <h2 className="flex items-center gap-2 font-medium text-success">
          <CircleCheck className="size-4" aria-hidden />
          Başvurunuz alındı
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ekibimiz bilgileri doğrulayıp size dönecek. Doğrulama için işletmenin
          bilinen numarasından arayabiliriz.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-muted/30 p-5">
      <h2 className="flex items-center gap-2 font-medium">
        <BadgeCheck className="size-4" aria-hidden />
        {venueName} sizin işletmeniz mi?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Bu profili biz oluşturduk ve henüz sahiplenilmedi. Profili sahiplenerek
        bilgileri güncelleyebilir, fotoğraf ekleyebilir ve gelen teklif
        taleplerini görebilirsiniz.
      </p>

      {!acik ? (
        <Button size="lg" className="mt-4 h-10" onClick={() => setAcik(true)}>
          Profilinizi sahiplenin
        </Button>
      ) : (
        <form
          noValidate
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            setErrors({});
            setFormError(null);
            startTransition(async () => {
              const r = await submitVenueClaim({ ...data, venueId, devam });
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                setFormError(r.message);
                return;
              }
              setGonderildi(true);
            });
          }}
        >
          {formError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              İşletmeyle bağınız
            </span>
            <textarea
              name="note"
              rows={3}
              maxLength={1000}
              placeholder="Örn. işletmenin sahibiyim, vergi no 1234567890. Kurumsal e-postam info@ornek.com."
              aria-invalid={errors.note ? true : undefined}
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                errors.note ? "border-destructive" : "border-input"
              }`}
            />
            {errors.note ? (
              <span role="alert" className="mt-1 block text-xs text-destructive">
                {errors.note}
              </span>
            ) : (
              <span className="mt-1 block text-xs text-muted-foreground">
                Doğrulamayı hızlandırır: vergi numarası, kurumsal e-posta adresi
                veya işletmenin kayıtlı telefonu.
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              Size ulaşabileceğimiz telefon
            </span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={20}
              placeholder="0555 111 22 33"
              aria-invalid={errors.phone ? true : undefined}
              className={`h-11 w-full max-w-xs rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                errors.phone ? "border-destructive" : "border-input"
              }`}
            />
            {errors.phone ? (
              <span role="alert" className="mt-1 block text-xs text-destructive">
                {errors.phone}
              </span>
            ) : null}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="lg" className="h-10" disabled={pending}>
              {pending ? "Gönderiliyor…" : "Başvuruyu gönder"}
            </Button>
            <Button variant="ghost" size="lg" className="h-10" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
