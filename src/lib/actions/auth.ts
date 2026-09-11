"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  resetPasswordSchema, resetRequestSchema, signInSchema, signUpSchema,
} from "@/lib/schemas/auth";
import { actionError, actionOk, fieldErrorsOf, unexpectedError, type ActionResult } from "@/lib/errors";
import { SITE } from "@/lib/constants";

/**
 * Supabase hata mesajları İngilizce ve teknik. Kullanıcıya Türkçe ve
 * eyleme dönük karşılıklarını gösteriyoruz.
 *
 * DİKKAT: giriş hatasında "e-posta yok" ile "parola yanlış" AYRIMI
 * YAPILMIYOR — ayırmak, bir e-postanın sistemde kayıtlı olup olmadığını
 * sızdırır (kullanıcı numaralandırma).
 */
function turkishAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-posta veya parola hatalı.";
  if (m.includes("email not confirmed")) {
    return "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Bu e-posta adresi kabul edilmedi. Geçerli bir adres girin.";
  }
  if (m.includes("password")) return "Parola gereksinimleri karşılanmıyor.";
  // Tanımadığımız hatayı kullanıcıya ham hâliyle göstermiyoruz ama sunucuda
  // logluyoruz; aksi hâlde "işlem tamamlanamadı" teşhis edilemez bir duvar olur.
  console.error("[auth] eşlenmemiş Supabase hatası:", message);
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}

export async function signIn(input: unknown): Promise<ActionResult<{ next: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Lütfen formdaki hataları düzeltin.", fieldErrorsOf(parsed.error));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) return actionError(turkishAuthError(error.message));
    revalidatePath("/", "layout");
    return actionOk({ next: "/panel" });
  } catch (error) {
    return unexpectedError("signIn", error);
  }
}

export async function signUp(
  input: unknown,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Lütfen formdaki hataları düzeltin.", fieldErrorsOf(parsed.error));
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        // Profil, auth.users trigger'ı ile bu veriden oluşuyor (0003).
        data: { full_name: parsed.data.fullName, phone: parsed.data.phone ?? null },
        emailRedirectTo: `${SITE.url}/auth/callback`,
      },
    });
    if (error) return actionError(turkishAuthError(error.message));

    // E-posta doğrulaması açıksa oturum gelmiyor; kullanıcıyı bilgilendir.
    const needsConfirmation = !data.session;

    if (data.session && parsed.data.asOwner) {
      const { error: roleError } = await supabase.rpc("become_venue_owner");
      if (roleError) console.error("[signUp:become_venue_owner]", roleError.message);
    }

    revalidatePath("/", "layout");
    return actionOk({ needsConfirmation });
  } catch (error) {
    return unexpectedError("signUp", error);
  }
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Lütfen formdaki hataları düzeltin.", fieldErrorsOf(parsed.error));
  }
  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${SITE.url}/auth/callback?next=/sifre-yenile`,
    });
    // Hata olsa bile başarı dönüyoruz: farklı cevap vermek, bir e-postanın
    // kayıtlı olup olmadığını sızdırır.
    return actionOk();
  } catch (error) {
    return unexpectedError("requestPasswordReset", error);
  }
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Lütfen formdaki hataları düzeltin.", fieldErrorsOf(parsed.error));
  }
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return actionError("Parola sıfırlama bağlantısı geçersiz veya süresi dolmuş.");
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return actionError(turkishAuthError(error.message));
    revalidatePath("/", "layout");
    return actionOk();
  } catch (error) {
    return unexpectedError("updatePassword", error);
  }
}

/** Mekan oluşturma akışında müşteriyi mekan sahibine yükseltir. */
export async function becomeVenueOwner(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("become_venue_owner");
    if (error) return actionError("Rol güncellenemedi. Lütfen tekrar deneyin.");
    revalidatePath("/panel", "layout");
    return actionOk();
  } catch (error) {
    return unexpectedError("becomeVenueOwner", error);
  }
}
