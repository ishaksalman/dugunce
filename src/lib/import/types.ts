import type { SimilarVenue } from "@/types/db";

/**
 * Toplu giriş tipleri ve sabitleri.
 *
 * Neden ayrı dosya: `"use server"` modülü YALNIZCA async fonksiyon dışa
 * aktarabiliyor. Sabiti eylem dosyasında bırakmak modülün tamamını
 * derlenemez hale getiriyordu ve `tsc` bunu görmüyor — kural Next'in.
 */

/** Tek seferde en fazla bu kadar satır. Önizleme her satır için ağa çıkıyor. */
export const TOPLU_LIMIT = 50;

export interface BulkPreviewRow {
  satirNo: number;
  ham: string;
  name: string | null;
  phone: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  website: string | null;
  placeId: string | null;
  /** Google'daki ana kategori — düğün mekanı olmayanı ayıklamak için. */
  kategori: string | null;
  puan: number | null;
  puanAdedi: number | null;
  /** Katalogda benzer kayıtlar — kullanıcı satır satır karar versin. */
  benzer: SimilarVenue[];
  hata: string | null;
}

export interface BulkCommitResult {
  eklenen: number;
  atlanan: { name: string; sebep: string }[];
}
