"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setVenueStatus } from "@/lib/actions/admin";
import type { VenueStatus } from "@/types/db";

/** İnceleme ekranındaki karar kutusu. */
export function ReviewDecision({
  venueId,
  status,
  rejectionReason,
}: {
  venueId: string;
  status: VenueStatus;
  isFeatured: boolean;
  rejectionReason: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [redMod, setRedMod] = useState(false);
  const [gerekce, setGerekce] = useState("");

  const uygula = (yeni: VenueStatus, reason?: string) =>
    startTransition(async () => {
      const r = await setVenueStatus({ venueId, status: yeni, reason });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setRedMod(false);
      setGerekce("");
      toast.success(yeni === "PUBLISHED" ? "Mekan yayına alındı" : "Güncellendi");
      router.refresh();
    });

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="font-medium">Karar</h2>

      {status === "REJECTED" && rejectionReason ? (
        <p className="mt-3 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Önceki red gerekçesi: {rejectionReason}
        </p>
      ) : null}

      {redMod ? (
        <div className="mt-4 space-y-2">
          <label htmlFor="red-gerekce" className="block text-xs font-medium">
            Red gerekçesi — mekan sahibine gösterilir
          </label>
          <textarea
            id="red-gerekce"
            rows={4}
            autoFocus
            maxLength={1000}
            value={gerekce}
            onChange={(e) => setGerekce(e.target.value)}
            placeholder="Fotoğraflar mekanı temsil etmiyor. Lütfen gerçek fotoğraflar ekleyin."
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="h-9 flex-1"
              disabled={pending || gerekce.trim().length === 0}
              onClick={() => uygula("REJECTED", gerekce)}
            >
              {pending ? "Gönderiliyor…" : "Reddet"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              disabled={pending}
              onClick={() => {
                setRedMod(false);
                setGerekce("");
              }}
            >
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {status !== "PUBLISHED" ? (
            <Button
              size="lg"
              className="h-10 w-full gap-2"
              disabled={pending}
              onClick={() => uygula("PUBLISHED")}
            >
              <Check className="size-4" aria-hidden />
              Onayla ve yayınla
            </Button>
          ) : null}

          {status === "PENDING_REVIEW" || status === "PUBLISHED" ? (
            <Button
              variant="outline"
              size="lg"
              className="h-10 w-full gap-2"
              disabled={pending}
              onClick={() => setRedMod(true)}
            >
              <X className="size-4" aria-hidden />
              {status === "PUBLISHED" ? "Askıya al" : "Reddet"}
            </Button>
          ) : null}

          {status === "PUBLISHED" ? (
            <p className="pt-1 text-xs text-muted-foreground">
              Mekan yayında. Askıya alırsan vitrinden kalkar ama verisi korunur.
            </p>
          ) : status === "PENDING_REVIEW" ? (
            <p className="pt-1 text-xs text-muted-foreground">
              Onaylarsan mekan hemen vitrinde görünür.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
