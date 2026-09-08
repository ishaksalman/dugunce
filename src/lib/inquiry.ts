import type { InquiryStatus } from "@/types/db";

/**
 * Talep durumlarının Türkçe karşılıkları ve sırası.
 *
 * DİKKAT: bu sabitler `"use client"` bir modülde DURAMAZ. Sunucu bileşeni
 * client modülünden düz bir değer import ettiğinde RSC sınırında gerçek
 * değeri değil bir referansı alır ve `Array.includes` gibi çağrılar
 * çalışma zamanında patlar.
 */
export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: "Yeni",
  CONTACTED: "İletişime geçildi",
  QUOTED: "Teklif verildi",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  CLOSED: "Kapatıldı",
};

export const INQUIRY_STATUS_ORDER: InquiryStatus[] = [
  "NEW", "CONTACTED", "QUOTED", "ACCEPTED", "REJECTED", "CLOSED",
];

export function isInquiryStatus(value: unknown): value is InquiryStatus {
  return typeof value === "string" && INQUIRY_STATUS_ORDER.includes(value as InquiryStatus);
}
