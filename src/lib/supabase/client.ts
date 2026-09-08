"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Tarayıcı istemcisi. YALNIZCA Storage yüklemesi için kullanılıyor —
 * veri okuma/yazma sunucu tarafında, servis katmanından geçer.
 *
 * Yükleme neden istemciden: dosya sunucuya, oradan Storage'a taşınırsa
 * her fotoğraf iki kez ağdan geçer ve server action gövde limitine takılır.
 * Storage politikaları (0007) kullanıcının yalnızca kendi mekanının
 * klasörüne yazmasına izin veriyor.
 */
let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  cached ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
