"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { moderateReview } from "@/lib/actions/admin";
import type { ReviewStatus } from "@/types/db";

export function ReviewActions({
  reviewId,
  status,
}: {
  reviewId: string;
  status: ReviewStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [redMod, setRedMod] = useState(false);
  const [not, setNot] = useState("");

  const uygula = (yeni: ReviewStatus, note?: string) =>
    startTransition(async () => {
      const r = await moderateReview({ reviewId, status: yeni, note });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setRedMod(false);
      setNot("");
      toast.success(yeni === "APPROVED" ? "Yorum yayınlandı" : "Yorum reddedildi");
      router.refresh();
    });

  if (redMod) {
    return (
      <div className="w-full space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <label htmlFor={`not-${reviewId}`} className="block text-xs font-medium">
          Red notu (yalnızca yönetim görür)
        </label>
        <textarea
          id={`not-${reviewId}`}
          rows={2}
          autoFocus
          maxLength={1000}
          value={not}
          onChange={(e) => setNot(e.target.value)}
          placeholder="Hakaret içeriyor."
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="h-8"
            disabled={pending}
            onClick={() => uygula("REJECTED", not)}
          >
            {pending ? "Gönderiliyor…" : "Reddet"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={pending}
            onClick={() => {
              setRedMod(false);
              setNot("");
            }}
          >
            Vazgeç
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "APPROVED" ? (
        <Button
          size="sm"
          className="h-8 gap-1.5"
          disabled={pending}
          onClick={() => uygula("APPROVED")}
        >
          <Check className="size-3.5" aria-hidden />
          Onayla
        </Button>
      ) : null}
      {status !== "REJECTED" ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          disabled={pending}
          onClick={() => setRedMod(true)}
        >
          <X className="size-3.5" aria-hidden />
          Reddet
        </Button>
      ) : null}
    </div>
  );
}
