"use server";

import { revalidatePath } from "next/cache";
import { getDataSource } from "@/lib/db";
import { getRequestFingerprint } from "@/lib/rate-limit";
import { inquirySchema } from "@/lib/schemas/inquiry";
import { actionError, actionOk, unexpectedError, type ActionResult } from "@/lib/errors";
import { notifyTelegram } from "@/lib/telegram";

/** Telegram HTML parse_mode'unda özel anlamı olan karakterleri kaçırır. */
function kacir(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const RATE_LIMIT_MESSAGES: Record<string, string> = {
  rate_limited_venue:
    "Bu mekana bugün zaten talep gönderdiniz. Mekan sizinle en kısa sürede iletişime geçecek.",
  rate_limited_hour:
    "Kısa sürede çok fazla talep gönderdiniz. Lütfen bir saat sonra tekrar deneyin.",
  venue_not_found: "Bu mekan şu anda talep kabul etmiyor.",
};

export async function submitInquiry(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return actionError("Lütfen formdaki hataları düzeltin.", fieldErrors);
  }

  // Bal küpü doluysa bot. Başarılı gibi cevaplıyoruz ki bot yeniden denemesin,
  // ama hiçbir şey kaydetmiyoruz.
  if (parsed.data.website) {
    return actionOk({ id: "" });
  }

  try {
    const { ipHash, uaHash } = await getRequestFingerprint();
    const db = await getDataSource();
    const result = await db.createInquiry({
      venueId: parsed.data.venueId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      eventTypeId: parsed.data.eventTypeId,
      eventDate: parsed.data.eventDate,
      guestCount: parsed.data.guestCount,
      message: parsed.data.message,
      ipHash,
      uaHash,
    });

    if (!result.ok) {
      return actionError(RATE_LIMIT_MESSAGES[result.reason] ?? RATE_LIMIT_MESSAGES.venue_not_found);
    }

    // Sahiplenilmemiş mekana gelen talebi kimse görmüyordu — owner_id NULL,
    // /panel/talepler kimseye ait değil. İşletmeye otomatik mesaj ATMIYORUZ
    // (izinsiz ticari ileti KVKK/İYS'ye aykırı); onun yerine admin'e haber
    // veriyoruz, ilk teması admin kişisel olarak kuruyor (bkz. lib/telegram.ts).
    // Bildirim başarısız olsa bile talep zaten kaydedildi — kullanıcıyı ASLA
    // bekletmiyor/bloklamıyoruz.
    if (!result.is_claimed) {
      // await ediliyor: Vercel gibi serverless ortamlarda yanıt gönderildikten
      // sonra fonksiyon donduruluyor, await'siz bir "fire and forget" isteği
      // yarıda kalabilir. notifyTelegram kendi içinde 5 sn zaman aşımlı ve
      // asla fırlatmıyor — bu satır talebi engellemiyor, yalnızca biraz erteliyor.
      await notifyTelegram(
        `🔔 <b>Yeni talep — sahipsiz mekan</b>\n` +
        `Mekan: <b>${kacir(result.venue_name)}</b> (${kacir(result.district_name)}, ${kacir(result.city_name)})\n` +
        `Talep eden: ${kacir(parsed.data.fullName)}\n` +
        `Telefon: ${kacir(parsed.data.phone)}\n` +
        (parsed.data.message ? `Mesaj: ${kacir(parsed.data.message)}\n` : "") +
        `\nBu mekan henüz sahiplenilmedi — işletmeyi arayıp bilgilendirmeyi düşün.`,
      );
    }

    // Mekan sahibinin panelindeki talep sayısı tazelensin (P4).
    revalidatePath("/panel/talepler");
    return actionOk({ id: result.id });
  } catch (error) {
    return unexpectedError("submitInquiry", error);
  }
}
