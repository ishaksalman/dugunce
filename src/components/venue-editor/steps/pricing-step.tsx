"use client";

import { Field, StepForm, inputClass } from "../form-shell";
import { saveVenuePricing } from "@/lib/actions/venue";
import type { VenueForEdit } from "@/types/db";

const FIYAT_TIPLERI = [
  { value: "kisi_basi", label: "Kişi başı" },
  { value: "paket", label: "Paket (toplam)" },
  { value: "gunluk", label: "Günlük" },
  { value: "belirtilmemis", label: "Belirtilmemiş" },
];

export function PricingStep({ venue }: { venue: VenueForEdit }) {
  return (
    <StepForm action={(data) => saveVenuePricing(venue.id, data)}>
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="fiyat-baslangic"
              label="Başlangıç fiyatı (₺)"
              error={errors.startingPrice}
              hint="Kartlarda &quot;₺75.000'den başlayan&quot; şeklinde görünür."
            >
              <input
                id="fiyat-baslangic"
                name="startingPrice"
                type="number"
                min={0}
                step={100}
                defaultValue={venue.starting_price ?? ""}
                placeholder="75000"
                className={`${inputClass(errors.startingPrice)} tabular`}
              />
            </Field>
            <Field id="fiyat-tip" label="Fiyat tipi" error={errors.priceType}>
              <select
                id="fiyat-tip"
                name="priceType"
                defaultValue={venue.price_type}
                className={inputClass(errors.priceType)}
              >
                {FIYAT_TIPLERI.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            id="fiyat-not"
            label="Fiyat açıklaması"
            error={errors.priceNote}
            hint="Fiyatın neye göre değiştiğini yazın: sezon, gün, menü, davetli sayısı…"
          >
            <textarea
              id="fiyat-not"
              name="priceNote"
              rows={3}
              maxLength={500}
              defaultValue={venue.price_note ?? ""}
              placeholder="Fiyat; davetli sayısı, menü seçimi ve sezona göre değişir. Hafta içi %15 indirimlidir."
              className={`${inputClass(errors.priceNote)} h-auto py-2.5 leading-relaxed`}
            />
          </Field>
        </>
      )}
    </StepForm>
  );
}
