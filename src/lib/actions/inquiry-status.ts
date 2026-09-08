"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { actionError, actionOk, unexpectedError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  id: z.string().uuid(),
  status: z
    .enum(["NEW", "CONTACTED", "QUOTED", "ACCEPTED", "REJECTED", "CLOSED"])
    .optional(),
  ownerNote: z
    .string()
    .trim()
    .max(2000, "Not en fazla 2000 karakter olabilir.")
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
});

/**
 * Talebin durumunu ve sahibin özel notunu günceller.
 *
 * Yetki iki katmanda: burada rol kontrolü (nazik hata için), veritabanında
 * RLS + `guard_inquiry_update` trigger'ı (asıl kapı — sahip talep sahibinin
 * yazdığı hiçbir alana dokunamaz).
 */
export async function updateInquiry(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Geçersiz istek.");
  }
  try {
    await requireRole(["venue_owner", "admin"]);
    const db = await getDataSource();
    await db.updateInquiry(parsed.data.id, {
      status: parsed.data.status,
      ownerNote: parsed.data.ownerNote,
    });
    revalidatePath("/panel/talepler");
    revalidatePath("/panel");
    return actionOk();
  } catch (error) {
    return unexpectedError("updateInquiry", error);
  }
}
