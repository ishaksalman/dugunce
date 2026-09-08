"use server";

import { revalidatePath } from "next/cache";
import { getDataSource } from "@/lib/db";
import { getRequestFingerprint } from "@/lib/rate-limit";
import { inquirySchema } from "@/lib/schemas/inquiry";
import { actionError, actionOk, unexpectedError, type ActionResult } from "@/lib/errors";

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

    // Mekan sahibinin panelindeki talep sayısı tazelensin (P4).
    revalidatePath("/panel/talepler");
    return actionOk({ id: result.id });
  } catch (error) {
    return unexpectedError("submitInquiry", error);
  }
}
