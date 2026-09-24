/**
 * Türkçe slug — istemci tarafında (arayüz içinde) kullanmak için.
 *
 * SQL'deki `slugify_tr()` ve `supabase/seed/apply.mjs`'deki `slugify()` ile
 * AYNI sonucu vermeli (CLAUDE.md). Üçüncü bir kopya olmasının sebebi: seed
 * betiği düz `node` ile (tip sıyırma bayrağı OLMADAN) çalışıyor, bu dosyadan
 * import edemiyor; bu dosya ise `"use client"` bileşenlerinden çağrılıyor.
 *
 * Kullanım alanı: kaynağın verdiği serbest metin ilçe adını (ör. "Esenyurt")
 * bizim ilçe taksonomimizdeki `slug` ile eşleştirmek — sunucu tarafında
 * `slugify_tr()` ile üretilmiş `slug` alanıyla karşılaştırılıyor.
 */
export function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
    Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u", Â: "a", Î: "i", Û: "u",
  };
  return input
    .replace(/[çğıöşüâîûÇĞİIÖŞÜÂÎÛ]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}
