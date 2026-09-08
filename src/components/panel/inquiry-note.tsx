"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateInquiry } from "@/lib/actions/inquiry-status";

/** Mekan sahibinin kendi notu. Talep sahibi bu notu göremez. */
export function InquiryNote({
  id,
  note,
}: {
  id: string;
  note: string | null;
}) {
  const [value, setValue] = useState(note ?? "");
  const [saved, setSaved] = useState(note ?? "");
  const [pending, startTransition] = useTransition();
  const degisti = value.trim() !== saved.trim();

  return (
    <div className="space-y-2">
      <label htmlFor={`not-${id}`} className="block text-xs font-medium text-muted-foreground">
        Özel notunuz (talep sahibi göremez)
      </label>
      <textarea
        id={`not-${id}`}
        rows={2}
        maxLength={2000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Aradım, 3 Ağustos için müsait değiliz; alternatif tarih önerdim…"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
      />
      {degisti ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-8"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateInquiry({ id, ownerNote: value });
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                setSaved(value);
                toast.success("Not kaydedildi");
              })
            }
          >
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={pending}
            onClick={() => setValue(saved)}
          >
            Vazgeç
          </Button>
        </div>
      ) : null}
    </div>
  );
}
