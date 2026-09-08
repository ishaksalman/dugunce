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
