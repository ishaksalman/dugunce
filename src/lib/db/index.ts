import "server-only";
import type { DataSource } from "./source";
import { supabaseConfigured } from "@/lib/supabase/server";

/**
 * Uygulamanın veritabanına tek giriş noktası.
 *
 * Tek bir uygulama var: Supabase. (Geliştirme için ikinci bir PGlite
 * uygulaması vardı; Supabase bağlandıktan sonra kaldırıldı — iki uygulamayı
 * senkron tutmanın bedeli, sürücülerin zaman damgalarını farklı döndürmesi
 * gibi sessiz ayrışmalarla ödeniyordu.)
 *
 * Şema testleri hâlâ PGlite üzerinde gerçek PostgreSQL çalıştırıyor
 * (`npm run test:db`) — orada migration'ların kendisi sınanıyor, uygulama
 * kodu değil.
 */
export async function getDataSource(): Promise<DataSource> {
  if (!supabaseConfigured) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil. " +
      ".env.local dosyasını doldurun.",
    );
  }
  const { supabaseSource } = await import("./supabase");
  return supabaseSource;
}

export type { DataSource, SearchInput, SearchResult } from "./source";
