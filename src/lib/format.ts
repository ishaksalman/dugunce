/**
 * Türkçe biçimlendirme. Tüm para ve sayı gösterimi buradan geçer;
 * component içinde elle `toLocaleString` çağrılmaz.
 */
import type { PriceType } from "@/types/db";

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat("tr-TR");

export function formatPrice(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null;
  return TRY.format(value);
}

export function formatNumber(value: number): string {
  return NUM.format(value);
}

const PRICE_SUFFIX: Record<PriceType, string> = {
  kisi_basi: "kişi başı",
  paket: "paket",
  gunluk: "günlük",
  belirtilmemis: "",
};

/**
 * "₺75.000'den başlayan · kişi başı" gibi tek satırlık fiyat ifadesi.
 * `maxValue` verilmişse (kaynak çoğu zaman ARALIK veriyor, bkz. 0040)
 * "₺75.000 – ₺95.000 · kişi başı" biçiminde gösteriliyor.
 * Fiyat girilmemişse kullanıcıya "fiyat yok" demek yerine teklife yönlendiriyoruz.
 */
export function formatStartingPrice(
  value: number | null,
  type: PriceType,
  maxValue: number | null = null,
): { primary: string; secondary: string | null } {
  const price = formatPrice(value);
  if (!price) return { primary: "Fiyat için teklif alın", secondary: null };
  const suffix = PRICE_SUFFIX[type];
  const max = maxValue !== null && maxValue > (value ?? 0) ? formatPrice(maxValue) : null;
  return {
    primary: max ? `${price} – ${max}` : `${price}'den başlayan`,
    secondary: suffix || null,
  };
}

/** "100–500 kişi" / "500 kişiye kadar" / "En az 100 kişi" */
export function formatCapacity(min: number | null, max: number | null): string | null {
  if (min && max) return `${formatNumber(min)}–${formatNumber(max)} kişi`;
  if (max) return `${formatNumber(max)} kişiye kadar`;
  if (min) return `En az ${formatNumber(min)} kişi`;
  return null;
}

/** Puanı her zaman tek ondalıkla: 4.8 → "4,8" */
export function formatRating(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export const formatDate = (value: string | Date): string =>
  new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(typeof value === "string" ? new Date(value) : value);

/**
 * "5321234567" → "0532 123 45 67" — yalnızca `contact_phone_norm` (0029,
 * her zaman 10 hane olduğunda) için. Tanımadığımız uzunluk ham hâliyle
 * bırakılır; uydurma biçimlendirme yapılmaz.
 */
export function formatPhoneDisplay(norm: string | null): string | null {
  if (!norm || norm.length !== 10) return norm;
  return `0${norm.slice(0, 3)} ${norm.slice(3, 6)} ${norm.slice(6, 8)} ${norm.slice(8, 10)}`;
}

/** `tel:` bağlantısı — dialer'lar esnek, 10 hane olmayan bir norm bile çalışır. */
export function phoneForTel(norm: string | null): string | null {
  if (!norm) return null;
  return norm.length === 10 ? `+90${norm}` : `+${norm}`;
}

/**
 * `wa.me` bağlantısı için uluslararası biçim ZORUNLU (ülke kodu + boşluksuz
 * rakamlar, + yok). Yalnızca güvenle 10 haneye indirgenmiş numaralarda
 * gösteriliyor — emin olamadığımızda kırık bağlantı vermektense hiç
 * göstermiyoruz.
 */
export function phoneForWhatsapp(norm: string | null): string | null {
  if (!norm || norm.length !== 10) return null;
  return `90${norm}`;
}
