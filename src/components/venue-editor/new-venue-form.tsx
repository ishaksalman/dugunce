"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./form-shell";
import { createVenue } from "@/lib/actions/venue";
import type { City } from "@/types/db";

interface Ilce { id: string; slug: string; name: string }

export function NewVenueForm({ cities }: { cities: City[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cache, setCache] = useState<{ city: string; items: Ilce[] } | null>(null);

  const districts = cache && cache.city === cityId ? cache.items : [];
  const loading = Boolean(cityId) && cache?.city !== cityId;

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
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setErrors({});
        setFormError(null);
        startTransition(async () => {
          const result = await createVenue(data);
          if (!result.ok) {
            setErrors(result.fieldErrors ?? {});
            setFormError(result.message);
            return;
          }
          // Oluşturunca doğrudan wizard'ın ilk adımına.
          router.replace(`/panel/mekanlarim/${result.data.id}/temel-bilgiler`);
          router.refresh();
        });
      }}
      className="space-y-5"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <Field id="yeni-ad" label="Mekan adı" required error={errors.name}>
        <input
          id="yeni-ad"
          name="name"
          required
          placeholder="Bahçe Davet"
          className={inputClass(errors.name)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="yeni-sehir" label="Şehir" required error={errors.cityId}>
          <select
            id="yeni-sehir"
            name="cityId"
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
              setDistrictId("");
            }}
            className={inputClass(errors.cityId)}
          >
            <option value="">Şehir seçin</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field id="yeni-ilce" label="İlçe" required error={errors.districtId}>
          <select
            id="yeni-ilce"
            name="districtId"
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            disabled={!cityId || loading}
            className={inputClass(errors.districtId)}
          >
            <option value="">
              {!cityId ? "Önce şehir seçin" : loading ? "Yükleniyor…" : "İlçe seçin"}
            </option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
        {pending ? "Oluşturuluyor…" : "Mekanı oluştur ve devam et"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Mekanınız taslak olarak oluşturulur. Siz göndermeden yayına çıkmaz.
      </p>
    </form>
  );
}
