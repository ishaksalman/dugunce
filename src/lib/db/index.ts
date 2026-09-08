import "server-only";
import type { DataSource } from "./source";
import { supabaseConfigured } from "@/lib/supabase/server";

let warned = false;

/**
 * Supabase yapılandırılmışsa onu, değilse geliştirme veritabanını döndürür.
 * Üretimde Supabase zorunlu — yanlışlıkla PGlite ile canlıya çıkmayı
 * engellemek için build/çalışma zamanında hata veriyoruz.
 */
export async function getDataSource(): Promise<DataSource> {
  if (supabaseConfigured) {
    const { supabaseSource } = await import("./supabase");
    return supabaseSource;
  }
  if (process.env.NODE_ENV === "production") {
    // GEÇİCİ KAÇIŞ KAPISI. Supabase projesi bağlanana kadar üretim build'inin
    // derlenip prerender edilebildiğini doğrulamak için var. Supabase
    // yapılandırıldığı anda bu değişken ve bu blok silinecek.
    // Sunucuyu bu bayrakla AYAĞA KALDIRMAYIN: veri diskteki geçici bir
    // PGlite dizininden gelir, RLS devrede değildir, deploy'lar arasında kaybolur.
    if (process.env.DAVETMEKANI_ALLOW_DEV_DB === "1") {
      console.warn(
        "[db] UYARI: üretim modunda geliştirme veritabanı kullanılıyor " +
        "(DAVETMEKANI_ALLOW_DEV_DB=1). Yalnızca build doğrulaması içindir.",
      );
      const { pgliteSource } = await import("./pglite");
      return pgliteSource;
    }
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil. " +
      "Üretimde geliştirme veritabanı kullanılamaz.",
    );
  }
  if (!warned) {
    warned = true;
    console.warn(
      "[db] Supabase yapılandırılmadı — yerel PGlite geliştirme veritabanı kullanılıyor.",
    );
  }
  const { pgliteSource } = await import("./pglite");
  return pgliteSource;
}

export type { DataSource, SearchInput, SearchResult } from "./source";
