import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Ham IP ve User-Agent HİÇBİR YERDE saklanmaz. Yalnızca tuzlanmış özetleri
 * `inquiries.ip_hash` / `ua_hash` alanlarına yazılır; hız sınırı ve spam
 * tespiti için bu kadarı yeterli, kişiyi geri getirmek için yeterli değil.
 *
 * Asıl sınırlama veritabanındaki `create_inquiry()` fonksiyonunda; burası
 * yalnızca kimliklendirme anahtarını üretiyor.
 */
function hash(value: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    // Tuz olmadan hash tersine çevrilebilir hâle gelir (IP uzayı küçük).
    // Geliştirmede uyarıp devam ediyoruz, üretimde durmalı.
    if (process.env.NODE_ENV === "production") {
      throw new Error("IP_HASH_SALT tanımlı değil.");
    }
    console.warn("[rate-limit] IP_HASH_SALT tanımlı değil — geliştirme tuzu kullanılıyor.");
  }
  return createHash("sha256")
    .update(`${salt ?? "gelistirme-tuzu"}:${value}`)
    .digest("hex")
    .slice(0, 32);
}

export async function getRequestFingerprint(): Promise<{
  ipHash: string | null;
  uaHash: string | null;
}> {
  const h = await headers();
  // Vercel/proxy arkasında gerçek istemci ilk sıradadır.
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || null;
  const ua = h.get("user-agent");
  return {
    ipHash: ip ? hash(ip) : null,
    uaHash: ua ? hash(ua) : null,
  };
}
