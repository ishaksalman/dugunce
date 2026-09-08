import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Oturumsuz, çerezsiz istemci — herkese açık okumalar için.
 *
 * NEDEN AYRI: çerez okuyan istemci (`server.ts`) sayfayı Next'in gözünde
 * dinamik yapıyor ve statik üretim/ISR devre dışı kalıyor. Ana sayfa ve mekan
 * detayı bizim SEO yüzeyimiz; her istekte sunucuda render edilmeleri hem
 * yavaş hem gereksiz. Bu istemci anon anahtarıyla bağlanır, RLS'in anonim
 * politikaları geçerlidir — zaten yalnızca PUBLISHED içerik okuyoruz.
 *
 * Oturuma bağlı işler (kullanıcının kendi talepleri, favoriler, panel) için
 * `server.ts` içindeki çerez farkındalıklı istemci kullanılır.
 */
let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createPublicClient() {
  cached ??= createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}
