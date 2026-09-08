"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { DavetProError, verifyLinkCode, davetProYapilandirildiMi } from "@/lib/integrations/davetpro";
import { processSyncQueue } from "@/lib/services/davetpro-sync";
import { actionError, actionOk, unexpectedError, type ActionResult } from "@/lib/errors";

const linkSchema = z.object({
  venueId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NP-Z2-9]{6}$/, "Kod 6 karakter olmalı (örn. A7K2M9)."),
});

/**
 * Mekanı DavetPro'ya bağlar.
 *
 * Akış: kullanıcı DavetPro'da ürettiği kodu buraya girer → kodu DavetPro'da
 * doğrularız → dönen business_id/venue_id'yi kaydederiz → o mekanın TÜM
 * geçmiş talepleri kuyruğa girer ve aktarılır.
 */
export async function linkVenueToDavetPro(
  input: unknown,
): Promise<ActionResult<{ businessName: string; queued: number }>> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Geçersiz kod.");
  }
  if (!davetProYapilandirildiMi()) {
    return actionError("DavetPro entegrasyonu bu ortamda yapılandırılmamış.");
  }

  try {
    await requireRole(["venue_owner", "admin"]);

    const dogrulama = await verifyLinkCode(parsed.data.code);

    // Bağlama ve geçmiş kuyruğa alma tek fonksiyonda; sahiplik kontrolü
    // orada yapılıyor (RLS'e ek olarak).
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("link_venue_to_davetpro", {
      p_venue_id: parsed.data.venueId,
      p_business_id: dogrulama.business_id,
      p_davetpro_venue_id: dogrulama.venue_id ?? null,
    });
    if (error) {
      return actionError(
        error.message.includes("yetkiniz yok")
          ? "Bu mekanı bağlama yetkiniz yok."
          : "Bağlantı kurulamadı. Lütfen tekrar deneyin.",
      );
    }

    const sonuc = data as { queued_inquiries: number };

    // Geçmişi hemen aktarmaya başla; kullanıcı DavetPro'ya geçtiğinde
    // taleplerini orada bulsun. Hata olursa kuyruk yeniden dener.
    void processSyncQueue(100).catch((e) =>
      console.error("[linkVenueToDavetPro] kuyruk", (e as Error).message),
    );

    revalidatePath("/panel", "layout");
    return actionOk({
      businessName: dogrulama.business_name,
      queued: sonuc.queued_inquiries,
    });
  } catch (error) {
    if (error instanceof DavetProError) {
      // 410 = kod geçersiz/kullanılmış/süresi dolmuş. Ayrımı kullanıcıya
      // vermiyoruz; DavetPro da vermiyor.
      if (error.status === 410) {
        return actionError(
          "Kod geçersiz veya süresi dolmuş. DavetPro'dan yeni bir kod alın.",
        );
      }
      return actionError("DavetPro'ya ulaşılamadı. Lütfen biraz sonra tekrar deneyin.");
    }
    return unexpectedError("linkVenueToDavetPro", error);
  }
}

export async function unlinkVenueFromDavetPro(
  venueId: unknown,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(venueId);
  if (!parsed.success) return actionError("Geçersiz mekan.");

  try {
    await requireRole(["venue_owner", "admin"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("unlink_venue_from_davetpro", {
      p_venue_id: parsed.data,
    });
    if (error) return actionError("Bağlantı kaldırılamadı.");
    revalidatePath("/panel", "layout");
    return actionOk();
  } catch (error) {
    return unexpectedError("unlinkVenueFromDavetPro", error);
  }
}
