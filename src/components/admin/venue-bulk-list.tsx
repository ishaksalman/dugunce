"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminVenueRow } from "./venue-row";
import { bulkPublishVenues } from "@/lib/actions/admin";
import type { AdminVenue } from "@/types/db";

/**
 * Mekan listesi + çoklu seçim ve toplu yayınlama.
 *
 * Yalnızca YAYINDA OLMAYAN satırlarda seçim kutusu var — zaten yayında olanı
 * seçip tekrar yayınlamanın bir anlamı yok. Reddetme/askıya alma BİLEREK
 * buradan yapılamıyor (bkz. `bulkPublishVenues`): gerekçe mekana özel olmalı.
 */
export function VenueBulkList({ items }: { items: AdminVenue[] }) {
  const router = useRouter();
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const secilebilir = items.filter((v) => v.status !== "PUBLISHED");
  const tumu = secilebilir.length > 0 && secilebilir.every((v) => secili.has(v.id));

  const toggle = (id: string, checked: boolean) => {
    setSecili((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {secilebilir.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={tumu}
              onCheckedChange={(v) =>
                setSecili(v ? new Set(secilebilir.map((it) => it.id)) : new Set())
              }
            />
            Tümünü seç
          </label>
          <span className="text-sm text-muted-foreground">
            {secili.size} mekan seçili
          </span>
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={secili.size === 0 || pending}
            onClick={() => {
              startTransition(async () => {
                const r = await bulkPublishVenues([...secili]);
                if (!r.ok) {
                  toast.error(r.message);
                  return;
                }
                toast.success(`${r.data.basarili} mekan yayınlandı`);
                setSecili(new Set());
                router.refresh();
              });
            }}
          >
            {pending ? "Yayınlanıyor…" : "Seçilenleri yayınla"}
          </Button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((v) => (
          <li key={v.id} className="flex items-start gap-3">
            {v.status !== "PUBLISHED" ? (
              <Checkbox
                className="mt-5 shrink-0"
                aria-label={`${v.name} seç`}
                checked={secili.has(v.id)}
                onCheckedChange={(c) => toggle(v.id, Boolean(c))}
              />
            ) : (
              <span className="mt-5 size-4 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <AdminVenueRow venue={v} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
