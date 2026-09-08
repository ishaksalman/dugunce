"use client";

import { useState } from "react";
import { Field, StepForm, inputClass } from "../form-shell";
import { saveVenueDescription } from "@/lib/actions/venue";
import { cn } from "@/lib/utils";
import type { VenueForEdit } from "@/types/db";

const ONERILEN = 200;

export function DescriptionStep({ venue }: { venue: VenueForEdit }) {
  const [uzunluk, setUzunluk] = useState(venue.description?.length ?? 0);

  return (
    <StepForm action={(data) => saveVenueDescription(venue.id, data)}>
      {(errors) => (
        <Field id="aciklama" label="Mekan açıklaması" error={errors.description}>
          <textarea
            id="aciklama"
            name="description"
            rows={12}
            maxLength={8000}
            defaultValue={venue.description ?? ""}
            onChange={(e) => setUzunluk(e.target.value.length)}
            placeholder="Mekanınızı anlatın: konumun avantajı, alanın özellikleri, misafirlerin en çok neyi beğendiği, hangi organizasyonlara uygun olduğu…"
            className={`${inputClass(errors.description)} h-auto py-3 leading-relaxed`}
          />
          <p
            className={cn(
              "tabular mt-1.5 text-xs",
              uzunluk >= ONERILEN ? "text-success" : "text-muted-foreground",
            )}
          >
            {uzunluk} karakter
            {uzunluk < ONERILEN
              ? ` · profil tamamlanma puanı için en az ${ONERILEN} karakter önerilir`
              : " · yeterli"}
          </p>
        </Field>
      )}
    </StepForm>
  );
}
