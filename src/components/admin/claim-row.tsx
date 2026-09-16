"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reviewVenueClaim } from "@/lib/actions/admin";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminClaim } from "@/types/db";

const DURUM = {
  PENDING: { label: "Bekliyor", cls: "bg-warning/15 text-warning-foreground" },
  APPROVED: { label: "Onaylandı", cls: "bg-success/15 text-success" },
  REJECTED: { label: "Reddedildi", cls: "bg-destructive/10 text-destructive" },
} as const;

export function ClaimRow({ claim }: { claim: AdminClaim }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [redForm, setRedForm] = useState(false);
  const [gerekce, setGerekce] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  const bekliyor = claim.status === "PENDING";

  const gonder = (approve: boolean, note?: string) =>
    startTransition(async () => {
      setHata(null);
      const r = await reviewVenueClaim({ claimId: claim.id, approve, note });
      if (!r.ok) {
        setHata(r.message);
        return;
      }
      toast.success(approve ? "Sahiplik devredildi" : "Başvuru reddedildi");
      setRedForm(false);
      router.refresh();
    });

  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Vitrin adresi şehir ve ilçe slug'ı istiyor; başvuru listesinde
              onlar yok. İnceleme zaten yönetim kaydından yapılıyor. */}
          <h3 className="font-medium">{claim.venue_name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {claim.district_name}, {claim.city_name}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            DURUM[claim.status].cls,
          )}
        >
          {DURUM[claim.status].label}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Başvuran</dt>
          <dd className="mt-0.5">{claim.claimant_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">E-posta</dt>
          <dd className="mt-0.5 break-all">{claim.claimant_email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Telefon</dt>
          <dd className="tabular mt-0.5">{claim.claimant_phone ?? "—"}</dd>
        </div>
      </dl>

      {claim.note ? (
        <blockquote className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm whitespace-pre-line">
          {claim.note}
        </blockquote>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        {formatDate(claim.created_at)} tarihinde başvuruldu
      </p>

      {claim.review_note && !bekliyor ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Karar notu: {claim.review_note}
        </p>
      ) : null}

      {hata ? (
        <p role="alert" className="mt-3 text-sm text-destructive">{hata}</p>
      ) : null}

      {bekliyor ? (
        <div className="mt-4 border-t pt-4">
          {redForm ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium" htmlFor={`gerekce-${claim.id}`}>
                Reddetme gerekçesi
              </label>
              <textarea
                id={`gerekce-${claim.id}`}
                value={gerekce}
                onChange={(e) => setGerekce(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Başvuran neyi eksik bıraktı?"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9"
                  disabled={pending || gerekce.trim().length === 0}
                  onClick={() => gonder(false, gerekce)}
                >
                  Reddet
                </Button>
                <Button variant="ghost" size="sm" className="h-9" onClick={() => setRedForm(false)}>
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-9 gap-1.5"
                disabled={pending}
                onClick={() => gonder(true)}
              >
                <Check className="size-3.5" aria-hidden />
                Onayla ve sahipliği devret
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                disabled={pending}
                onClick={() => setRedForm(true)}
              >
                <X className="size-3.5" aria-hidden />
                Reddet
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5"
                render={<Link href={`/yonetim/mekanlar/${claim.venue_id}`} />}
                nativeButton={false}
              >
                Kaydı incele
                <ExternalLink className="size-3.5" aria-hidden />
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}
