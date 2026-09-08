import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Servis rolü istemcisi — RLS'i TAMAMEN atlar.
 *
 * Yalnızca çağıranın yetkisi başka bir yolla doğrulandıktan sonra kullanılır
 * (cron gizli anahtarı, imzalı webhook). Kullanıcı isteğine doğrudan bağlı
 * bir akışta ASLA kullanma — `createClient()` (çerezli) ya da
 * `createPublicClient()` (anonim) kullan.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil.");
  }
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
