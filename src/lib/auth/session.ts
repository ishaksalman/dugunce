import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/db";

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
}

/**
 * Oturumdaki kullanıcı ve profili. İstek başına tekilleştirilmiş.
 *
 * `getUser()` kullanılıyor, `getSession()` DEĞİL: ikincisi çerezdeki veriyi
 * sunucuda doğrulamadan okuyor ve sahte çerezle kandırılabilir.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    fullName: profile.full_name,
    phone: profile.phone,
    role: profile.role,
    isActive: profile.is_active,
  };
});

/** Oturum yoksa giriş sayfasına gönderir. */
export async function requireUser(devam?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(devam ? `/giris?devam=${encodeURIComponent(devam)}` : "/giris");
  }
  if (!user.isActive) {
    redirect("/giris?hata=hesap-pasif");
  }
  return user;
}

/**
 * Rol kontrolü. Yetkisiz kullanıcıyı 404'e düşürüyoruz — "burada bir yönetim
 * paneli var ama giremezsin" demek gereksiz bilgi veriyor.
 */
export async function requireRole(
  roles: UserRole[],
  devam?: string,
): Promise<SessionUser> {
  const user = await requireUser(devam);
  if (!roles.includes(user.role)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}
