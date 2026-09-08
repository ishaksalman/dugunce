import "server-only";
import { cache } from "react";
import { getDataSource } from "@/lib/db";

/**
 * Mekan sahibi paneli sorguları.
 *
 * Hepsi oturuma bağlı; RLS ve fonksiyon içindeki sahiplik koşulu filtreliyor.
 * Servis katmanı ayrıca kontrol yapmıyor — tek doğruluk kaynağı veritabanı.
 */
export const getMyVenues = cache(async () => {
  const db = await getDataSource();
  return db.getMyVenues();
});

export const getOwnerStats = cache(async (venueId: string) => {
  const db = await getDataSource();
  return db.getOwnerStats(venueId);
});
