import { z } from "zod";

/**
 * Mekan düzenleme adımlarının şemaları.
 *
 * Her adım kendi başına kaydediliyor; kullanıcı yarım bıraktığında
 * kaybetmesin. Bu yüzden şemalar "yayına hazır mı" sorusunu SORMUYOR —
 * o kontrol `venue_completion_of()` ile veritabanında (0002) ve yayına
 * gönderme trigger'ında (0003).
 */

const optionalText = (max: number) =>
  z
    .union([z.literal(""), z.string().trim().max(max)])
    .optional()
    .transform((v) => (v ? v : null));

const optionalUrl = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
      .pipe(z.string().url("Geçerli bir adres girin.")),
  ])
  .optional()
  .transform((v) => (v ? v : null));

const optionalInt = (max: number) =>
  z
    .union([z.literal(""), z.coerce.number().int().positive().max(max)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v)));

const phone = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s()\-.]/g, ""))
      .refine((v) => /^(\+90)?0?[2-5]\d{9}$/.test(v), {
        message: "Geçerli bir telefon girin (örn. 0212 123 45 67).",
      }),
  ])
  .optional()
  .transform((v) => (v ? v : null));

export const venueBasicsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mekan adı en az 2 karakter olmalı.")
    .max(120, "Mekan adı en fazla 120 karakter olabilir."),
  venueTypeId: z
    .union([z.literal(""), z.string().uuid()])
    .optional()
    .transform((v) => (v ? v : null)),
  shortDescription: optionalText(200),
  contactPhone: phone,
  contactEmail: z
    .union([z.literal(""), z.string().trim().email("Geçerli bir e-posta girin.")])
    .optional()
    .transform((v) => (v ? v : null)),
  websiteUrl: optionalUrl,
  instagramUrl: optionalUrl,
});

/**
 * Google işletme bağlantısı için host beyaz listesi.
 *
 * Bu adres herkese açık mekan sayfasında <a href> olarak basılıyor; serbest
 * bırakılırsa vitrin, mekan sahibinin istediği yere giden bir yönlendirme
 * yüzeyi olur. Aynı kural veritabanında da kısıt olarak duruyor (0022) —
 * burası kullanıcıya nazik hata vermek için.
 */
const GOOGLE_MAPS_HOSTS = [
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
];

export function isGoogleMapsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  // google.com.tr, google.de … ülke uzantıları da geçerli.
  const googleDomain = /^(www\.)?google(\.[a-z]{2,3}){1,2}$/.test(host);
  if (!GOOGLE_MAPS_HOSTS.includes(host) && !googleDomain) return false;
  if (host === "goo.gl") return url.pathname.startsWith("/maps/");
  if (host === "maps.app.goo.gl" || host === "maps.google.com") return true;
  return url.pathname.startsWith("/maps");
}

export const venueLocationSchema = z.object({
  cityId: z.string().uuid("Şehir seçin."),
  districtId: z.string().uuid("İlçe seçin."),
  address: optionalText(300),
  latitude: z
    .union([z.literal(""), z.coerce.number().min(-90).max(90)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v))),
  longitude: z
    .union([z.literal(""), z.coerce.number().min(-180).max(180)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v))),
  googleMapsUrl: z
    .union([z.literal(""), z.string().trim().url().max(500).refine(isGoogleMapsUrl, {
      message: "Yalnızca Google Maps bağlantısı kabul ediliyor.",
    })])
    .optional()
    .transform((v) => (v ? v : null)),
});

export const venueCapacitySchema = z
  .object({
    minCapacity: optionalInt(100000),
    maxCapacity: optionalInt(100000),
    hasIndoor: z.coerce.boolean().default(false),
    hasOutdoor: z.coerce.boolean().default(false),
  })
  .refine(
    (d) => d.minCapacity === null || d.maxCapacity === null || d.maxCapacity >= d.minCapacity,
    { message: "Maksimum kapasite minimumdan küçük olamaz.", path: ["maxCapacity"] },
  );

export const venueServicesSchema = z.object({
  featureIds: z.array(z.string().uuid()).max(100).default([]),
  eventTypeIds: z.array(z.string().uuid()).max(30).default([]),
});

export const venuePricingSchema = z.object({
  startingPrice: z
    .union([z.literal(""), z.coerce.number().nonnegative().max(100_000_000)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v))),
  priceType: z.enum(["kisi_basi", "paket", "gunluk", "belirtilmemis"]).default("belirtilmemis"),
  priceNote: optionalText(500),
});

export const venueDescriptionSchema = z.object({
  description: optionalText(8000),
});

/** Yeni mekan: en az kimlik bilgisi. Gerisi wizard'da doldurulur. */
export const venueCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mekan adı en az 2 karakter olmalı.")
    .max(120, "Mekan adı en fazla 120 karakter olabilir."),
  cityId: z.string().uuid("Şehir seçin."),
  districtId: z.string().uuid("İlçe seçin."),
});

export type VenueBasicsInput = z.infer<typeof venueBasicsSchema>;
export type VenueLocationInput = z.infer<typeof venueLocationSchema>;
export type VenueCapacityInput = z.infer<typeof venueCapacitySchema>;
export type VenueServicesInput = z.infer<typeof venueServicesSchema>;
export type VenuePricingInput = z.infer<typeof venuePricingSchema>;

/** Wizard adımları — sıra ve etiketler tek yerde. */
export const VENUE_STEPS = [
  { slug: "temel-bilgiler", label: "Temel bilgiler" },
  { slug: "konum", label: "Konum" },
  { slug: "kapasite", label: "Kapasite" },
  { slug: "hizmetler", label: "Hizmetler" },
  { slug: "fiyatlandirma", label: "Fiyatlandırma" },
  { slug: "fotograflar", label: "Fotoğraflar" },
  { slug: "aciklama", label: "Açıklama" },
  { slug: "onizleme", label: "Önizleme" },
] as const;

export type VenueStepSlug = (typeof VENUE_STEPS)[number]["slug"];

export function isVenueStep(value: unknown): value is VenueStepSlug {
  return VENUE_STEPS.some((s) => s.slug === value);
}
