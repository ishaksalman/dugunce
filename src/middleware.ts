import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Rota koruması ve oturum tazeleme.
 *
 * Buradaki kontrol kullanıcıyı doğru sayfaya yönlendirmek içindir, YETKİ
 * KONTROLÜ DEĞİLDİR. Yetkiyi RLS ve sunucu eylemlerindeki guard'lar belirler;
 * middleware atlansa bile veriye erişilemez.
 */
/**
 * Yalnızca işletme ve yönetim alanları oturum istiyor.
 *
 * `/favorilerim` BİLEREK burada değil: favoriler tarayıcıda (localStorage)
 * tutuluyor ve üyeliksiz çalışıyor. Müşteri üyeliği MVP kapsamı dışında.
 */
const KORUMALI = ["/panel", "/yonetim"];
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
     *
     * `api/integrations` ve `api/cron` DIŞARIDA: bunlar oturumla değil HMAC
     * imzası / cron anahtarı ile kimlik doğruluyor. Matcher'a girerlerse her
     * webhook ve her kuyruk tetiklemesi boşuna bir Supabase auth çağrısı
     * yapar. (DavetPro tarafında aynı dışlama src/proxy.ts içinde.)
     */
    "/((?!api/integrations|api/cron|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
