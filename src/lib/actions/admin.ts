"use server";

import { revalidatePath } from "next/cache";
import { revalidateVenuePage } from "@/lib/revalidate";
import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import {
  actionError, actionOk, invalidInput, unexpectedError, type ActionResult,
} from "@/lib/errors";

const VENUE_STATUS = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "SUSPENDED"] as const;
const USER_ROLE = ["customer", "venue_owner", "admin"] as const;
const REVIEW_STATUS = ["PENDING", "APPROVED", "REJECTED"] as const;

/** Veritabanı hatalarını kullanıcıya gösterilebilir Türkçeye çevirir. */
function turkishError(message: string): string {
  if (message.includes("Gerekçe zorunlu")) {
    return "Reddetme ve askıya alma için gerekçe yazmalısınız.";
  }
  if (message.includes("Kendi rolünüzü")) return "Kendi rolünüzü değiştiremezsiniz.";
  if (message.includes("Kendi hesabınızı")) return "Kendi hesabınızı kapatamazsınız.";
  if (message.includes("yönetici yetkisi")) return "Bu işlem için yönetici yetkisi gerekiyor.";
  if (message.includes("bulunamadı")) return "Kayıt bulunamadı.";
  if (message.includes("ilçe bu şehre ait değil")) return "Seçilen ilçe bu şehre ait değil.";
  if (message.includes("zaten sonuçlanmış")) return "Bu başvuru zaten sonuçlanmış.";
  if (message.includes("arada sahiplenilmiş")) {
    return "Bu profil arada başka bir başvuruyla sahiplenilmiş.";
  }
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}

function tazele() {
  revalidatePath("/yonetim", "layout");
  // Mekan durumu değişince vitrin de etkileniyor.
  revalidatePath("/mekanlar");
  revalidatePath("/");
}

const statusSchema = z.object({
  venueId: z.string().uuid(),
  status: z.enum(VENUE_STATUS),
  reason: z
    .string()
    .trim()
    .max(1000, "Gerekçe en fazla 1000 karakter olabilir.")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export async function setVenueStatus(input: unknown): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Geçersiz istek.");
  }
  // Gerekçe zorunluluğunu burada da kontrol ediyoruz ki kullanıcı formu
  // göndermeden uyarı alsın; asıl kural veritabanında.
  if (
    (parsed.data.status === "REJECTED" || parsed.data.status === "SUSPENDED") &&
    !parsed.data.reason
  ) {
    return actionError("Reddetme ve askıya alma için gerekçe yazmalısınız.", {
      reason: "Gerekçe zorunlu.",
    });
  }
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminSetVenueStatus(parsed.data.venueId, parsed.data.status, parsed.data.reason);
    tazele();
    // Askıya alınan mekan önbellekten DÜŞMELİ; yayına alınan da hemen
    // görünmeli. Liste sayfalarını tazelemek detay sayfasını kapsamıyor.
    await revalidateVenuePage(parsed.data.venueId);
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("setVenueStatus", error);
  }
}

const featuredSchema = z.object({
  venueId: z.string().uuid(),
  featured: z.coerce.boolean(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export async function setVenueFeatured(input: unknown): Promise<ActionResult> {
  const parsed = featuredSchema.safeParse(input);
  if (!parsed.success) return actionError("Geçersiz istek.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    const until = parsed.data.featured
      ? new Date(Date.now() + (parsed.data.days ?? 30) * 86_400_000).toISOString()
      : undefined;
    await db.adminSetVenueFeatured(parsed.data.venueId, parsed.data.featured, until);
    tazele();
    await revalidateVenuePage(parsed.data.venueId);
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("setVenueFeatured", error);
  }
}

export async function setUserRole(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ userId: z.string().uuid(), role: z.enum(USER_ROLE) })
    .safeParse(input);
  if (!parsed.success) return actionError("Geçersiz istek.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminSetUserRole(parsed.data.userId, parsed.data.role);
    revalidatePath("/yonetim", "layout");
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("setUserRole", error);
  }
}

export async function setUserActive(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      userId: z.string().uuid(),
      active: z.coerce.boolean(),
      reason: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
    })
    .safeParse(input);
  if (!parsed.success) return actionError("Geçersiz istek.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminSetUserActive(parsed.data.userId, parsed.data.active, parsed.data.reason);
    revalidatePath("/yonetim", "layout");
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("setUserActive", error);
  }
}

export async function moderateReview(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      reviewId: z.string().uuid(),
      status: z.enum(REVIEW_STATUS),
      note: z.string().trim().max(1000).optional().transform((v) => (v ? v : undefined)),
    })
    .safeParse(input);
  if (!parsed.success) return actionError("Geçersiz istek.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminModerateReview(parsed.data.reviewId, parsed.data.status, parsed.data.note);
    tazele();
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("moderateReview", error);
  }
}

const seoPatchSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(10).max(160).optional(),
  metaDescription: z.string().trim().max(320).optional(),
  h1: z.string().trim().min(3).max(160).optional(),
  introHtml: z.string().trim().max(8000).optional(),
  minVenueCount: z.coerce.number().int().min(1).max(50).optional(),
  isActive: z.coerce.boolean().optional(),
});

export async function updateSeoPage(input: unknown): Promise<ActionResult> {
  const parsed = seoPatchSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Geçersiz istek.");
  }
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    const { id, ...patch } = parsed.data;
    await db.adminUpdateSeoPage(id, patch);
    revalidatePath("/yonetim/seo");
    // Landing sayfası ISR ile önbellekte; metin değişince tazelensin.
    revalidatePath("/[landing]", "page");
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("updateSeoPage", error);
  }
}

/**
 * Sayfaları yeniden üretir. Elle düzenlenmiş metinleri EZMEZ — üretim
 * yalnızca yeni satır ekler ve aktifliği eşiğe göre günceller.
 */
export async function refreshSeoPages(minVenues: unknown): Promise<ActionResult<{ ozet: string }>> {
  const parsed = z.coerce.number().int().min(1).max(50).default(3).safeParse(minVenues);
  if (!parsed.success) return actionError("Geçersiz eşik.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    const sonuc = await db.adminRefreshSeoPages(parsed.data);
    revalidatePath("/yonetim/seo");
    return actionOk({
      ozet: `${sonuc.total} sayfa · ${sonuc.active} aktif · ${sonuc.inactive} eşik altında`,
    });
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("refreshSeoPages", error);
  }
}

// --- Taksonomi ---------------------------------------------------------------


/**
 * Taksonomi vitrinin her yerinde: filtre paneli, ana sayfa, landing sayfaları,
 * mekan detayı. Bir satır değişince hepsi bayatlıyor.
 *
 * Mekan detayını tek tek tazelemiyoruz — taksonomi nadiren değişiyor ve
 * detay sayfası zaten saatte bir kendini yeniliyor.
 */
function taksonomiTazele() {
  revalidatePath("/yonetim/taksonomi");
  revalidatePath("/", "layout");
  revalidatePath("/mekanlar");
  revalidatePath("/[landing]", "page");
}

const adSchema = z.string().trim().min(2, "En az 2 karakter.").max(60, "En fazla 60 karakter.");
const idSchema = z.union([z.string().uuid(), z.literal("")]).optional()
  .transform((v) => (v ? v : null));
const siraSchema = z.coerce.number().int().min(0).max(9999).default(0);

const eventTypeSchema = z.object({
  id: idSchema,
  name: adSchema,
  seoNoun: z.string().trim().min(2, "En az 2 karakter.").max(60),
  icon: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
  sortOrder: siraSchema,
  isActive: z.coerce.boolean().default(false),
});

export async function saveEventType(input: unknown): Promise<ActionResult> {
  const parsed = eventTypeSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminUpsertEventType(parsed.data);
    taksonomiTazele();
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("saveEventType", error);
  }
}

const venueTypeSchema = z.object({
  id: idSchema,
  name: adSchema,
  sortOrder: siraSchema,
  isActive: z.coerce.boolean().default(false),
});

export async function saveVenueType(input: unknown): Promise<ActionResult> {
  const parsed = venueTypeSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminUpsertVenueType(parsed.data);
    taksonomiTazele();
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("saveVenueType", error);
  }
}

const featureSchema = z.object({
  id: idSchema,
  kind: z.enum(["ozellik", "hizmet"]),
  groupName: z.string().trim().min(2, "En az 2 karakter.").max(60),
  name: adSchema,
  icon: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
  isFilter: z.coerce.boolean().default(false),
  sortOrder: siraSchema,
  isActive: z.coerce.boolean().default(false),
});

export async function saveFeature(input: unknown): Promise<ActionResult> {
  const parsed = featureSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminUpsertFeature(parsed.data);
    taksonomiTazele();
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("saveFeature", error);
  }
}

export async function setCityPopular(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ cityId: z.string().uuid(), popular: z.coerce.boolean() })
    .safeParse(input);
  if (!parsed.success) return actionError("Geçersiz istek.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminSetCityPopular(parsed.data.cityId, parsed.data.popular);
    taksonomiTazele();
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("setCityPopular", error);
  }
}

const districtSchema = z.object({
  id: idSchema,
  cityId: z.string().uuid(),
  name: adSchema,
});

export async function saveDistrict(input: unknown): Promise<ActionResult> {
  const parsed = districtSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminUpsertDistrict(parsed.data);
    taksonomiTazele();
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("saveDistrict", error);
  }
}

// --- Katalog kaydı ve sahiplenme ---------------------------------------------

const katalogSchema = z.object({
  name: z.string().trim().min(2, "En az 2 karakter.").max(120),
  cityId: z.string().uuid("Şehir seçin."),
  districtId: z.string().uuid("İlçe seçin."),
  categoryId: z.union([z.string().uuid(), z.literal("")]).optional()
    .transform((v) => (v ? v : null)),
  venueTypeId: z.union([z.string().uuid(), z.literal("")]).optional()
    .transform((v) => (v ? v : null)),
  address: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
  contactPhone: z.string().trim().max(20).optional().transform((v) => (v ? v : null)),
  websiteUrl: z.union([z.literal(""), z.string().trim().url("Geçerli bir adres girin.").max(300)])
    .optional().transform((v) => (v ? v : null)),
});

/**
 * Sahiplenilmemiş katalog kaydı açar.
 *
 * Kayıt TASLAK doğuyor ve sahipsiz: vitrinde görünmüyor. Yönetim içeriği
 * doldurup yayına aldıktan sonra işletme sahibi profili sahiplenebiliyor.
 */
export async function createCatalogVenue(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = katalogSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    const sonuc = await db.adminCreateVenue(parsed.data);
    revalidatePath("/yonetim/mekanlar");
    return actionOk({ id: sonuc.id });
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("createCatalogVenue", error);
  }
}

const basvuruSchema = z.object({
  claimId: z.string().uuid(),
  approve: z.coerce.boolean(),
  note: z.string().trim().max(1000).optional().transform((v) => (v ? v : undefined)),
});

export async function reviewVenueClaim(input: unknown): Promise<ActionResult> {
  const parsed = basvuruSchema.safeParse(input);
  if (!parsed.success) return actionError("Geçersiz istek.");
  // Reddetme gerekçesi veritabanında da zorunlu; burada kullanıcıya nazik hata.
  if (!parsed.data.approve && !parsed.data.note) {
    return actionError("Reddetme gerekçesi yazmalısınız.", {
      note: "Gerekçe zorunlu.",
    });
  }
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminReviewClaim(parsed.data.claimId, parsed.data.approve, parsed.data.note);
    revalidatePath("/yonetim", "layout");
    // Vitrindeki "profilinizi sahiplenin" çağrısı onaydan sonra kaybolmalı.
    revalidatePath("/mekanlar/[sehir]/[ilce]/[slug]", "page");
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(turkishError(error.message));
    return unexpectedError("reviewVenueClaim", error);
  }
}
