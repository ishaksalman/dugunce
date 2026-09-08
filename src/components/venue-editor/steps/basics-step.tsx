"use client";

import { Field, StepForm, inputClass } from "../form-shell";
import { saveVenueBasics } from "@/lib/actions/venue";
import type { VenueForEdit, VenueType } from "@/types/db";

export function BasicsStep({
  venue,
  venueTypes,
}: {
  venue: VenueForEdit;
  venueTypes: VenueType[];
}) {
  return (
    <StepForm action={(data) => saveVenueBasics(venue.id, data)}>
      {(errors) => (
        <>
          <Field id="mekan-ad" label="Mekan adı" required error={errors.name}
            hint={venue.status === "DRAFT"
              ? "Taslakken adı değiştirmek web adresinizi de günceller."
              : "Yayındaki mekanın web adresi değişmez."}>
            <input
              id="mekan-ad"
              name="name"
              defaultValue={venue.name}
              required
              className={inputClass(errors.name)}
            />
          </Field>

          <Field id="mekan-tur" label="Mekan türü" error={errors.venueTypeId}>
            <select
              id="mekan-tur"
              name="venueTypeId"
              defaultValue={venue.venue_type_id ?? ""}
              className={inputClass(errors.venueTypeId)}
            >
              <option value="">Seçiniz</option>
              {venueTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>

          <Field
            id="mekan-kisa"
            label="Kısa açıklama"
            error={errors.shortDescription}
            hint="Kartlarda ve arama sonuçlarında görünür. En fazla 200 karakter."
          >
            <input
              id="mekan-kisa"
              name="shortDescription"
              defaultValue={venue.short_description ?? ""}
              maxLength={200}
              placeholder="Marmara kıyısında, 4 dönümlük peyzajlı davet bahçesi."
              className={inputClass(errors.shortDescription)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mekan-tel" label="İletişim telefonu" error={errors.contactPhone}>
              <input
                id="mekan-tel"
                name="contactPhone"
                type="tel"
                defaultValue={venue.contact_phone ?? ""}
                placeholder="0212 123 45 67"
                className={inputClass(errors.contactPhone)}
              />
            </Field>
            <Field id="mekan-eposta" label="İletişim e-postası" error={errors.contactEmail}>
              <input
                id="mekan-eposta"
                name="contactEmail"
                type="email"
                defaultValue={venue.contact_email ?? ""}
                placeholder="iletisim@mekan.com"
                className={inputClass(errors.contactEmail)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mekan-web" label="Web sitesi" error={errors.websiteUrl}>
              <input
                id="mekan-web"
                name="websiteUrl"
                defaultValue={venue.website_url ?? ""}
                placeholder="mekaniniz.com"
                className={inputClass(errors.websiteUrl)}
              />
            </Field>
            <Field id="mekan-ig" label="Instagram" error={errors.instagramUrl}>
              <input
                id="mekan-ig"
                name="instagramUrl"
                defaultValue={venue.instagram_url ?? ""}
                placeholder="instagram.com/mekaniniz"
                className={inputClass(errors.instagramUrl)}
              />
            </Field>
          </div>
        </>
      )}
    </StepForm>
  );
}
