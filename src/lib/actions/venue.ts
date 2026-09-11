"use server";

import { revalidatePath } from "next/cache";
import { revalidateVenuePage } from "@/lib/revalidate";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import {
  venueBasicsSchema, venueCapacitySchema, venueCreateSchema,
  venueDescriptionSchema, venueLocationSchema, venuePricingSchema,
  venueServicesSchema,
} from "@/lib/schemas/venue";
import { actionError, actionOk, unexpectedError, type ActionResult } from "@/lib/errors";

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

function invalid(error: Parameters<typeof fieldErrorsOf>[0]) {
  return actionError("Lütfen formdaki hataları düzeltin.", fieldErrorsOf(error));
}

/**
 * Yeni mekan. Yalnızca kimlik bilgisiyle taslak açılır; gerisi wizard'da.
 *
 * Rol yükseltmesi burada: müşteri ilk mekanını oluştururken mekan sahibi
 * olur. `become_venue_owner()` tek yönlü (0007) — admin düşürülmez.
 */
export async function createVenue(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = venueCreateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const user = await requireUser("/panel/mekanlarim/yeni");
    const supabase = await createClient();

    if (user.role === "customer") {
      const { error } = await supabase.rpc("become_venue_owner");
      if (error) return actionError("Hesabınız mekan sahibine yükseltilemedi.");
    }

    const { data: slug, error: slugError } = await supabase.rpc("suggest_venue_slug", {
      p_name: parsed.data.name,
      p_venue_id: null,
    });
    if (slugError) return actionError("Mekan adresi üretilemedi.");

    const { data, error } = await supabase
      .from("venues")
      .insert({
        owner_id: user.id,
        slug: slug as string,
        name: parsed.data.name,
        city_id: parsed.data.cityId,
        district_id: parsed.data.districtId,
      })
      .select("id")
      .single();

    if (error) {
      // guard_venue_insert her yeni mekanı DRAFT'a sabitliyor; buraya
      // düşen hata genelde ilçe/şehir tutarsızlığı.
      return actionError(
        error.message.includes("district")
          ? "Seçilen ilçe bu şehre ait değil."
          : "Mekan oluşturulamadı. Lütfen tekrar deneyin.",
      );
    }

    revalidatePath("/panel", "layout");
    return actionOk({ id: data.id });
  } catch (error) {
    return unexpectedError("createVenue", error);
  }
}

/** Adım kaydetmelerinin ortak gövdesi. */
async function saveStep(
  venueId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  const parsedId = z.string().uuid().safeParse(venueId);
  if (!parsedId.success) return actionError("Geçersiz mekan.");

  await requireUser();
  const supabase = await createClient();
  // RLS + guard_venue_update asıl kapı; sahibi olmayan 0 satır günceller.
  const { data, error } = await supabase
    .from("venues")
    .update(patch)
    .eq("id", parsedId.data)
    .select("id");

  if (error) {
    if (error.message.includes("tamamlanma oranı")) {
      return actionError(error.message);
    }
    return actionError("Kaydedilemedi. Lütfen tekrar deneyin.");
  }
  if (!data || data.length === 0) {
    return actionError("Bu mekanı düzenleme yetkiniz yok.");
  }

  revalidatePath(`/panel/mekanlarim/${parsedId.data}`, "layout");
  revalidatePath("/panel");
  await revalidateVenuePage(parsedId.data);
  return actionOk();
}

export async function saveVenueBasics(
  venueId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = venueBasicsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createClient();
    // Slug yalnızca TASLAKKEN adla birlikte değişir; yayındaki bir mekanın
    // adresini değiştirmek gelen bağlantıları ve SEO'yu kırar.
    const { data: mevcut } = await supabase
      .from("venues")
      .select("id")
      .eq("id", venueId)
      .maybeSingle();
    if (!mevcut) return actionError("Mekan bulunamadı.");

    const { data: venue } = await supabase.rpc("get_venue_for_edit", {
      p_venue_id: venueId,
    });
    const durum = (venue as { status?: string } | null)?.status;

    const patch: Record<string, unknown> = {
      name: parsed.data.name,
      venue_type_id: parsed.data.venueTypeId,
      short_description: parsed.data.shortDescription,
      contact_phone: parsed.data.contactPhone,
      contact_email: parsed.data.contactEmail,
      website_url: parsed.data.websiteUrl,
      instagram_url: parsed.data.instagramUrl,
    };

    if (durum === "DRAFT") {
      const { data: slug } = await supabase.rpc("suggest_venue_slug", {
        p_name: parsed.data.name,
        p_venue_id: venueId,
      });
      if (slug) patch.slug = slug as string;
    }

    return saveStep(venueId, patch);
  } catch (error) {
    return unexpectedError("saveVenueBasics", error);
  }
}

export async function saveVenueLocation(
  venueId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = venueLocationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    return await saveStep(venueId, {
      city_id: parsed.data.cityId,
      district_id: parsed.data.districtId,
      address: parsed.data.address,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      google_maps_url: parsed.data.googleMapsUrl,
    });
  } catch (error) {
    return unexpectedError("saveVenueLocation", error);
  }
}

export async function saveVenueCapacity(
  venueId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = venueCapacitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    return await saveStep(venueId, {
      min_capacity: parsed.data.minCapacity,
      max_capacity: parsed.data.maxCapacity,
      has_indoor: parsed.data.hasIndoor,
      has_outdoor: parsed.data.hasOutdoor,
    });
  } catch (error) {
    return unexpectedError("saveVenueCapacity", error);
  }
}

export async function saveVenuePricing(
  venueId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = venuePricingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    return await saveStep(venueId, {
      starting_price: parsed.data.startingPrice,
      price_type: parsed.data.priceType,
      price_note: parsed.data.priceNote,
    });
  } catch (error) {
    return unexpectedError("saveVenuePricing", error);
  }
}

export async function saveVenueDescription(
  venueId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = venueDescriptionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    return await saveStep(venueId, { description: parsed.data.description });
  } catch (error) {
    return unexpectedError("saveVenueDescription", error);
  }
}

/**
 * Özellikler ve etkinlik türleri. Uygulama `venue_features` tablosuna yazar;
 * `feature_slugs` kopyasını trigger günceller — o kolona ASLA elle yazılmaz.
 */
export async function saveVenueServices(
  venueId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = venueServicesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await requireUser();
    const supabase = await createClient();

    const { error: fError } = await supabase.rpc("set_venue_features", {
      p_venue_id: venueId,
      p_feature_ids: parsed.data.featureIds,
    });
    if (fError) {
      return actionError(
        fError.message.includes("row-level security")
          ? "Bu mekanı düzenleme yetkiniz yok."
          : "Özellikler kaydedilemedi.",
      );
    }

    const { error: eError } = await supabase.rpc("set_venue_event_types", {
      p_venue_id: venueId,
      p_event_type_ids: parsed.data.eventTypeIds,
    });
    if (eError) return actionError("Etkinlik türleri kaydedilemedi.");

    revalidatePath(`/panel/mekanlarim/${venueId}`, "layout");
    await revalidateVenuePage(venueId);
    return actionOk();
  } catch (error) {
    return unexpectedError("saveVenueServices", error);
  }
}

/**
 * Yayına gönder. Tek izinli geçiş DRAFT/REJECTED → PENDING_REVIEW ve o da
 * tamamlanma %60'ı geçince — kuralı `guard_venue_update` trigger'ı zorluyor,
 * buradaki kontrol yalnızca nazik hata için.
 */
export async function submitVenueForReview(venueId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(venueId);
  if (!parsed.success) return actionError("Geçersiz mekan.");
  try {
    return await saveStep(parsed.data, { status: "PENDING_REVIEW" });
  } catch (error) {
    return unexpectedError("submitVenueForReview", error);
  }
}

/** İncelemeden geri çek. */
export async function withdrawVenueFromReview(venueId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(venueId);
  if (!parsed.success) return actionError("Geçersiz mekan.");
  try {
    return await saveStep(parsed.data, { status: "DRAFT" });
  } catch (error) {
    return unexpectedError("withdrawVenueFromReview", error);
  }
}
