"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaxField, taxInput } from "./taxonomy-row";
import { createCatalogVenue } from "@/lib/actions/admin";
import type { BusinessCategory, City, VenueType } from "@/types/db";

interface Ilce { id: string; slug: string; name: string }

/**
 * Katalog kaydı açma formu.
 *
 * Amaç hız: yönetim bir işletmeyi bulup dakikalar içinde sisteme girsin.
 * Bu yüzden yalnızca kimlik alanları var — kapasite, fiyat, fotoğraf sonra
 * düzenleme sihirbazından giriliyor. Kayıt SAHİPSİZ ve TASLAK doğuyor.
 */
export function CatalogVenueForm({
  cities,
  categories,
  venueTypes,
}: {
  cities: City[];
  categories: BusinessCategory[];
  venueTypes: VenueType[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cache, setCache] = useState<{ city: string; items: Ilce[] } | null>(null);

  const districts = cache && cache.city === cityId ? cache.items : [];
  const loading = cityId !== "" && cache?.city !== cityId;

  useEffect(() => {
    const city = cities.find((c) => c.id === cityId);
    if (!city) return;
    const controller = new AbortController();
    fetch(`/api/taxonomy/districts?sehir=${encodeURIComponent(city.slug)}&ayrinti=1`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { districts: Ilce[] }) => setCache({ city: cityId, items: d.districts }))
      .catch((e) => {
        if (e.name !== "AbortError") setCache({ city: cityId, items: [] });
      });
    return () => controller.abort();
  }, [cityId, cities]);

  return (
    <form
      noValidate
      className="max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setErrors({});
        setFormError(null);
        startTransition(async () => {
          const r = await createCatalogVenue(data);
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            setFormError(r.message);
            return;
          }
          toast.success("Katalog kaydı açıldı", {
            description: "Şimdi içeriğini doldurup yayına alabilirsiniz.",
          });
          router.push(`/panel/mekanlarim/${r.data.id}/temel-bilgiler`);
        });
      }}
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <TaxField label="İşletme adı" error={errors.name}>
        <input name="name" autoFocus maxLength={120} className={taxInput} />
      </TaxField>

      {categories.length > 1 ? (
        <TaxField label="Kategori" error={errors.categoryId}>
          <select name="categoryId" className={taxInput}>
            {categories.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </TaxField>
      ) : (
        // Tek kategori varken seçim sormanın anlamı yok; sunucu varsayılanı kullanır.
        <input type="hidden" name="categoryId" value="" />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TaxField label="Şehir" error={errors.cityId}>
          <select
            name="cityId"
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
              setDistrictId("");
            }}
            className={taxInput}
          >
            <option value="">Şehir seçin</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </TaxField>

        <TaxField label="İlçe" error={errors.districtId}>
          <select
            name="districtId"
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            disabled={cityId === "" || loading}
            className={taxInput}
          >
            <option value="">
              {cityId === "" ? "Önce şehir seçin" : loading ? "Yükleniyor…" : "İlçe seçin"}
            </option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </TaxField>
      </div>

      <TaxField label="Mekan türü" error={errors.venueTypeId} hint="İsteğe bağlı">
        <select name="venueTypeId" className={taxInput}>
          <option value="">Belirtilmedi</option>
          {venueTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </TaxField>

      <TaxField label="Adres" error={errors.address} hint="İsteğe bağlı">
        <input name="address" maxLength={300} className={taxInput} />
      </TaxField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TaxField label="Telefon" error={errors.contactPhone} hint="İsteğe bağlı">
          <input name="contactPhone" maxLength={20} className={taxInput} />
        </TaxField>
        <TaxField label="Web sitesi" error={errors.websiteUrl} hint="İsteğe bağlı">
          <input name="websiteUrl" type="url" maxLength={300} className={taxInput} />
        </TaxField>
      </div>

      <div className="flex items-center gap-3 border-t pt-5">
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? "Açılıyor…" : "Katalog kaydı aç"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Kayıt sahipsiz ve taslak olarak açılır; vitrinde görünmez.
        </p>
      </div>
    </form>
  );
}
