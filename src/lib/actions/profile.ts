"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { actionError, actionOk, unexpectedError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Adınızı ve soyadınızı girin.")
    .max(120, "Ad soyad en fazla 120 karakter olabilir."),
  phone: z
    .union([z.literal(""), z.string().trim().transform((v) => v.replace(/[\s()\-.]/g, ""))])
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^(\+90|0)?5\d{9}$/.test(v), {
      message: "Geçerli bir cep telefonu girin (örn. 0555 123 45 67).",
    }),
});

/**
 * Profil güncelleme. Rol ve hesap durumu BURADAN DEĞİŞMEZ —
 * `guard_profile_role` trigger'ı (0003) o alanları kilitliyor.
 */
export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return actionError("Lütfen formdaki hataları düzeltin.", fieldErrors);
  }
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
      .eq("id", user.id);
    if (error) return actionError("Profil güncellenemedi. Lütfen tekrar deneyin.");
    revalidatePath("/panel", "layout");
    return actionOk();
  } catch (error) {
    return unexpectedError("updateProfile", error);
  }
}
