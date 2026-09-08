"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitVenueForReview, withdrawVenueFromReview } from "@/lib/actions/venue";
import { stepCompletion } from "@/lib/venue-steps";
import { VENUE_STEPS } from "@/lib/schemas/venue";
import { formatCapacity, formatStartingPrice } from "@/lib/format";
import type { VenueForEdit } from "@/types/db";

/** Yayına göndermek için gereken asgari tamamlanma. SQL tarafıyla aynı olmalı
 *  (guard_venue_update, 0003). */
const ESIK = 60;

export function PreviewStep({ venue }: { venue: VenueForEdit }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const completed = stepCompletion(venue);
  const eksikler = VENUE_STEPS.filter(
    (s) => s.slug !== "onizleme" && !completed[s.slug],
  );
  const yeterli = venue.completion_score >= ESIK;
  const price = formatStartingPrice(
    venue.starting_price === null ? null : Number(venue.starting_price),
    venue.price_type,
  );

  return (
    <div className="space-y-6">
      {/* --- Özet --- */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-heading text-lg">{venue.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {venue.district.name}, {venue.city.name}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Ozet
            label="Kapasite"
            value={formatCapacity(venue.min_capacity, venue.max_capacity)}
          />
          <Ozet label="Fiyat" value={price.primary} />
          <Ozet label="Fotoğraf" value={`${venue.images.length} adet`} />
          <Ozet label="Özellik" value={`${venue.feature_ids.length} adet`} />
          <Ozet label="Etkinlik türü" value={`${venue.event_type_ids.length} adet`} />
          <Ozet
            label="Açıklama"
            value={venue.description ? `${venue.description.length} karakter` : null}
          />
        </dl>
      </div>

      {/* --- Tamamlanma --- */}
      <div className="rounded-xl border p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Profil tamamlanma</p>
          <p className="tabular text-sm font-medium">%{venue.completion_score}</p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={venue.completion_score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profil tamamlanma oranı"
        >
          <div
            className={`h-full rounded-full transition-[width] ${
              yeterli ? "bg-success" : "bg-warning"
            }`}
            style={{ width: `${venue.completion_score}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Yayına göndermek için en az %{ESIK} gerekiyor.
        </p>

        {eksikler.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {eksikler.map((s) => (
              <li key={s.slug} className="flex items-center gap-2 text-sm">
                <AlertCircle className="size-4 shrink-0 text-warning" aria-hidden />
                <Link
                  href={`/panel/mekanlarim/${venue.id}/${s.slug}`}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {s.label} eksik
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            Tüm adımlar tamamlandı
          </p>
        )}
      </div>

      {/* --- Eylem --- */}
      {venue.status === "PENDING_REVIEW" ? (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-5">
          <p className="font-medium">Mekanınız inceleme kuyruğunda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ekibimiz en kısa sürede değerlendirecek. Bu sırada düzenlemeye devam
            edebilirsiniz.
          </p>
          <Button
            variant="outline"
            size="lg"
            className="mt-4 h-10"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await withdrawVenueFromReview(venue.id);
                if (!r.ok) toast.error(r.message);
                else {
                  toast.success("İnceleme talebi geri çekildi");
                  router.refresh();
                }
              })
            }
          >
            İncelemeden geri çek
          </Button>
        </div>
      ) : venue.status === "PUBLISHED" ? (
        <div className="rounded-xl border border-success/30 bg-success/5 p-5">
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            Mekanınız yayında
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Yaptığınız düzenlemeler anında yansır. İsim, şehir veya kapasite
            değişiklikleri tekrar incelemeye alınır ama mekan yayında kalır.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border p-5">
          <p className="font-medium">Yayına gönder</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ekibimiz mekanınızı inceleyip onayladıktan sonra yayına alınır.
            Onay genelde 1 iş günü sürer.
          </p>
          <Button
            size="lg"
            className="mt-4 h-10 gap-2"
            disabled={pending || !yeterli}
            onClick={() =>
              startTransition(async () => {
                const r = await submitVenueForReview(venue.id);
                if (!r.ok) toast.error(r.message);
                else {
                  toast.success("Mekanınız incelemeye gönderildi");
                  router.refresh();
                }
              })
            }
          >
            <Send className="size-4" aria-hidden />
            {pending ? "Gönderiliyor…" : "İncelemeye gönder"}
          </Button>
          {!yeterli ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Tamamlanma oranı %{ESIK}&apos;ı geçmeden gönderemezsiniz.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Ozet({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 font-medium">{value ?? "—"}</dd>
    </div>
  );
}
