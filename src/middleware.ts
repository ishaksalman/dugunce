import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Rota koruması ve oturum tazeleme.
 *
 * Buradaki kontrol kullanıcıyı doğru sayfaya yönlendirmek içindir, YETKİ
 * KONTROLÜ DEĞİLDİR. Yetkiyi RLS ve sunucu eylemlerindeki guard'lar belirler;
 * middleware atlansa bile veriye erişilemez.
 */
const KORUMALI = ["/panel", "/yonetim", "/favorilerim", "/taleplerim"];
const SADECE_MISAFIR = ["/giris", "/kayit"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!user && KORUMALI.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    // Giriş sonrası kullanıcı gitmek istediği yere dönsün.
    url.search = `?devam=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (user && SADECE_MISAFIR.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Statik varlıklar ve görsel optimizasyonu hariç her şey. Bunlarda
     * oturum tazelemek gereksiz ve her istekte Supabase'e gitmek pahalı.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
