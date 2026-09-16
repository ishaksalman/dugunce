"use server";

import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { actionError, actionOk, invalidInput, unexpectedError, type ActionResult } from "@/lib/errors";

const claimSchema = z.object({
  venueId: z.string().uuid(),
  note: z
    .string()
    .trim()
    .min(20, "Bağınızı biraz daha açıklayın (en az 20 karakter).")
    .max(1000, "En fazla 1000 karakter."),
  phone: z
    .string()
    .trim()
    .min(7, "Telefon numarası girin.")
    .max(20, "Telefon numarası çok uzun."),
  // Giriş gerekirse kullanıcı buraya geri dönsün.
  devam: z.string().startsWith("/").max(300).optional(),
});

/**
 * "Bu işletme benim" başvurusu.
 *
 * Sahipliği BU eylem vermiyor; yalnızca başvuru açıyor. Devri admin
 * `admin_review_claim()` ile yapıyor — profil sahipliğini kendi beyanına
 * göre dağıtmak, rakibin sayfasını ele geçirmeye açık kapı bırakırdı.
 */
export async function submitVenueClaim(input: unknown): Promise<ActionResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    // Oturum yoksa giriş sayfasına yönlendirir; dönüşte mekan sayfasına gelir.
    await requireUser(parsed.data.devam);
    const db = await getDataSource();
    await db.claimVenue(parsed.data.venueId, parsed.data.note, parsed.data.phone);
    return actionOk();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("zaten sahiplenilmiş")) {
        return actionError("Bu profil başka bir hesap tarafından sahiplenilmiş.");
      }
      if (error.message.includes("bekleyen bir başvurunuz")) {
        return actionError("Bu işletme için bekleyen bir başvurunuz zaten var.");
      }
    }
    return unexpectedError("submitVenueClaim", error);
  }
}
