import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * E-posta doğrulama ve parola sıfırlama bağlantılarının dönüş noktası.
 * Supabase koda karşılık oturum çerezini burada yazıyor.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  // Açık yönlendirme engeli: yalnızca site içi yollar.
  const hedef = next && next.startsWith("/") && !next.startsWith("//") ? next : "/panel";

  if (!code) {
    return NextResponse.redirect(new URL("/giris?hata=baglanti-gecersiz", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback]", error.message);
    return NextResponse.redirect(new URL("/giris?hata=baglanti-gecersiz", url.origin));
  }

  return NextResponse.redirect(new URL(hedef, url.origin));
}
