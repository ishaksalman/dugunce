"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { updateInquiry } from "@/lib/actions/inquiry-status";
import type { InquiryStatus } from "@/types/db";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUS_ORDER } from "@/lib/inquiry";

export function InquiryStatusSelect({
  id,
  status,
}: {
  id: string;
  status: InquiryStatus;
}) {
  const [value, setValue] = useState<InquiryStatus>(status);
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={value}
      disabled={pending}
      onValueChange={(next) => {
        const yeni = next as InquiryStatus;
        const onceki = value;
        // İyimser güncelleme: hata olursa geri alıyoruz.
        setValue(yeni);
        startTransition(async () => {
          const result = await updateInquiry({ id, status: yeni });
          if (!result.ok) {
            setValue(onceki);
            toast.error(result.message);
            return;
          }
          toast.success(`Durum "${INQUIRY_STATUS_LABELS[yeni]}" olarak güncellendi`);
        });
      }}
    >
      <SelectTrigger className="h-9 w-44" aria-label="Talep durumu">
        {/* Base UI ham değeri basar; Türkçe etiketi açıkça veriyoruz. */}
        <SelectValue>
          {(v) => INQUIRY_STATUS_LABELS[v as InquiryStatus] ?? String(v)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {INQUIRY_STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            {INQUIRY_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
