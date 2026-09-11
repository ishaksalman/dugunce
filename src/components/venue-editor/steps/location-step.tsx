"use client";

import { useEffect, useState } from "react";
import { Field, StepForm, inputClass } from "../form-shell";
import { saveVenueLocation } from "@/lib/actions/venue";
import type { City, VenueForEdit } from "@/types/db";

interface Ilce { id: string; slug: string; name: string }

export function LocationStep({
  venue,
  cities,
}: {
  venue: VenueForEdit;
  cities: City[];
}) {
  const [cityId, setCityId] = useState(venue.city_id);
  const [districtId, setDistrictId] = useState(venue.district_id);
  const [cache, setCache] = useState<{ city: string; items: Ilce[] } | null>(null);

  const districts = cache && cache.city === cityId ? cache.items : [];
  const loading = cache?.city !== cityId;

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
    <StepForm action={(data) => saveVenueLocation(venue.id, data)}>
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="konum-sehir" label="Şehir" required error={errors.cityId}>
              <select
                id="konum-sehir"
                name="cityId"
                value={cityId}
                onChange={(e) => {
                  setCityId(e.target.value);
                  // Şehir değişince ilçe geçersiz kalır; kullanıcı yeniden seçmeli.
                  setDistrictId("");
                }}
                className={inputClass(errors.cityId)}
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field id="konum-ilce" label="İlçe" required error={errors.districtId}>
              <select
                id="konum-ilce"
                name="districtId"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                disabled={loading}
                className={inputClass(errors.districtId)}
              >
                <option value="">{loading ? "Yükleniyor…" : "İlçe seçin"}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            id="konum-adres"
            label="Açık adres"
            error={errors.address}
            hint="Detay sayfasında gösterilir. Kesin adresi paylaşmak istemiyorsanız boş bırakabilirsiniz."
          >
            <input
              id="konum-adres"
              name="address"
              defaultValue={venue.address ?? ""}
              maxLength={300}
              className={inputClass(errors.address)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="konum-lat"
              label="Enlem"
              error={errors.latitude}
              hint="Google Maps'te konuma sağ tıklayıp koordinatı kopyalayabilirsiniz."
            >
              <input
                id="konum-lat"
                name="latitude"
                type="number"
                step="any"
                defaultValue={venue.latitude ?? ""}
                placeholder="40.9923"
                className={`${inputClass(errors.latitude)} tabular`}
              />
            </Field>
            <Field id="konum-lng" label="Boylam" error={errors.longitude}>
              <input
                id="konum-lng"
                name="longitude"
                type="number"
                step="any"
                defaultValue={venue.longitude ?? ""}
                placeholder="28.6412"
                className={`${inputClass(errors.longitude)} tabular`}
              />
            </Field>
          </div>

          <Field
            id="konum-google"
            label="Google işletme sayfası"
            error={errors.googleMapsUrl}
            hint="Detay sayfasında “Google’da yorumları oku” bağlantısı olarak çıkar. Google Maps’te işletmenizi bulup Paylaş › Bağlantıyı kopyala deyin."
          >
            <input
              id="konum-google"
              name="googleMapsUrl"
              type="url"
              inputMode="url"
              defaultValue={venue.google_maps_url ?? ""}
              placeholder="https://maps.app.goo.gl/…"
              maxLength={500}
              className={inputClass(errors.googleMapsUrl)}
            />
          </Field>
        </>
      )}
    </StepForm>
  );
}
