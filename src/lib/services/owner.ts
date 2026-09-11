import "server-only";
import { cache } from "react";
import { getDataSource } from "@/lib/db";
import type { InquiryStatus } from "@/types/db";

/** Talep listesi sayfa boyutu. */
export const INQUIRY_PAGE_SIZE = 25;

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

export const getOwnerInquiries = cache(
  async (input: {
    status?: InquiryStatus;
    venueId?: string;
    query?: string;
    page?: number;
  }) => {
    const db = await getDataSource();
    const page = Math.max(1, input.page ?? 1);
    return db.getOwnerInquiries({
      status: input.status,
      venueId: input.venueId,
      query: input.query,
      limit: INQUIRY_PAGE_SIZE,
      offset: (page - 1) * INQUIRY_PAGE_SIZE,
    });
  },
);


/** Düzenleme ekranı verisi. Sahibi olmadığı mekan için null. */
export const getVenueForEdit = cache(async (venueId: string) => {
  const db = await getDataSource();
  return db.getVenueForEdit(venueId);
});

/** DavetPro bağlantı ve aktarım durumu. */
export const getDavetProStatus = cache(async (venueId: string) => {
  const db = await getDataSource();
  return db.getDavetProStatus(venueId);
});
