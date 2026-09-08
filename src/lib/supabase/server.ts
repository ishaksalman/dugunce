import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Oturum farkındalıklı sunucu istemcisi. RLS bu istemcinin taşıdığı JWT'ye
 * göre çalışır — yetkilendirmenin uygulandığı yer burası değil, veritabanı.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(items) {
          try {
            for (const { name, value, options } of items) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Sunucu bileşeninden çağrıldığında çerez yazılamaz; oturum
            // tazeleme middleware'de yapılıyor, burada yutmak güvenli.
          }
        },
      },
    },
  );
}
