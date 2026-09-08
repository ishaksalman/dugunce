"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { actionError, actionOk, unexpectedError, type ActionResult } from "@/lib/errors";

const VENUE_IMAGE_BUCKET = "venue-images";

const attachSchema = z.object({
  venueId: z.string().uuid(),
  storagePath: z.string().min(3).max(300),
  width: z.number().int().positive().max(20000).nullish(),
  height: z.number().int().positive().max(20000).nullish(),
});

/**
 * Yüklenen dosyayı veritabanına kaydeder.
 *
 * Dosya tarayıcıdan doğrudan Storage'a gidiyor (bkz. lib/supabase/client.ts);
 * bu eylem yalnızca kaydı oluşturuyor. Storage politikası zaten yolun ilk
 * klasörünün kullanıcının mekanı olmasını şart koşuyor, ama burada da
 * doğruluyoruz: yol uydurulup başka mekana kayıt açılmasın.
 */
export async function attachVenueImage(input: unknown): Promise<ActionResult> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return actionError("Geçersiz görsel bilgisi.");

  const { venueId, storagePath, width, height } = parsed.data;
  if (!storagePath.startsWith(`${venueId}/`)) {
    return actionError("Görsel yolu bu mekana ait değil.");
  }

  try {
    await requireUser();
    const supabase = await createClient();

    const { count, error: sayimHata } = await supabase
      .from("venue_images")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    if (sayimHata) return actionError("Görseller okunamadı.");
    const adet = count ?? 0;

    if (adet >= 30) {
      return actionError("Bir mekana en fazla 30 fotoğraf ekleyebilirsiniz.");
    }

    const { data: publicUrl } = supabase.storage
      .from(VENUE_IMAGE_BUCKET)
      .getPublicUrl(storagePath);

    const { error } = await supabase.from("venue_images").insert({
      venue_id: venueId,
      storage_path: storagePath,
      url: publicUrl.publicUrl,
      width: width ?? null,
      height: height ?? null,
      sort_order: adet,
      // İlk fotoğraf otomatik kapak olur; kullanıcı sonra değiştirebilir.
      is_cover: adet === 0,
    });
    if (error) {
      return actionError(
        error.message.includes("row-level security")
          ? "Bu mekana fotoğraf ekleme yetkiniz yok."
          : "Fotoğraf kaydedilemedi.",
      );
    }

    revalidatePath(`/panel/mekanlarim/${venueId}`, "layout");
    return actionOk();
  } catch (error) {
    return unexpectedError("attachVenueImage", error);
  }
}

export async function deleteVenueImage(
  venueId: string,
  imageId: string,
): Promise<ActionResult> {
  const parsed = z.object({ venueId: z.string().uuid(), imageId: z.string().uuid() })
    .safeParse({ venueId, imageId });
  if (!parsed.success) return actionError("Geçersiz istek.");

  try {
    await requireUser();
    const supabase = await createClient();

    const { data: img } = await supabase
      .from("venue_images")
      .select("storage_path, is_cover")
      .eq("id", parsed.data.imageId)
      .eq("venue_id", parsed.data.venueId)
      .maybeSingle();
    if (!img) return actionError("Fotoğraf bulunamadı.");

    const { error } = await supabase
      .from("venue_images")
      .delete()
      .eq("id", parsed.data.imageId);
    if (error) return actionError("Fotoğraf silinemedi.");

    // Storage'daki dosyayı da temizle; başarısız olursa kayıt zaten silindi,
    // yetim dosya kalması kullanıcıyı etkilemiyor.
    await supabase.storage.from(VENUE_IMAGE_BUCKET).remove([img.storage_path]);

    // Kapak silindiyse kalanların ilki kapak olsun; mekan kapaksız kalmasın.
    if (img.is_cover) {
      const { data: kalan } = await supabase
        .from("venue_images")
        .select("id")
        .eq("venue_id", parsed.data.venueId)
        .order("sort_order")
        .limit(1);
      if (kalan?.[0]) {
        await supabase.from("venue_images").update({ is_cover: true }).eq("id", kalan[0].id);
      }
    }

    revalidatePath(`/panel/mekanlarim/${parsed.data.venueId}`, "layout");
    return actionOk();
  } catch (error) {
    return unexpectedError("deleteVenueImage", error);
  }
}

export async function setVenueCoverImage(
  venueId: string,
  imageId: string,
): Promise<ActionResult> {
  const parsed = z.object({ venueId: z.string().uuid(), imageId: z.string().uuid() })
    .safeParse({ venueId, imageId });
  if (!parsed.success) return actionError("Geçersiz istek.");
  try {
    await requireUser();
    const supabase = await createClient();
    // `enforce_single_cover` trigger'ı (0002) eskisini otomatik düşürüyor.
    const { error } = await supabase
      .from("venue_images")
      .update({ is_cover: true })
      .eq("id", parsed.data.imageId)
      .eq("venue_id", parsed.data.venueId);
    if (error) return actionError("Kapak seçilemedi.");
    revalidatePath(`/panel/mekanlarim/${parsed.data.venueId}`, "layout");
    return actionOk();
  } catch (error) {
    return unexpectedError("setVenueCoverImage", error);
  }
}

export async function reorderVenueImages(
  venueId: string,
  imageIds: string[],
): Promise<ActionResult> {
  const parsed = z
    .object({ venueId: z.string().uuid(), imageIds: z.array(z.string().uuid()).max(30) })
    .safeParse({ venueId, imageIds });
  if (!parsed.success) return actionError("Geçersiz istek.");
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_venue_images", {
      p_venue_id: parsed.data.venueId,
      p_image_ids: parsed.data.imageIds,
    });
    if (error) return actionError("Sıralama kaydedilemedi.");
    revalidatePath(`/panel/mekanlarim/${parsed.data.venueId}`, "layout");
    return actionOk();
  } catch (error) {
    return unexpectedError("reorderVenueImages", error);
  }
}
