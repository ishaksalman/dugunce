import { z } from "zod";

/** Türkiye cep/sabit hat: 05xx…, 5xx…, +90…, boşluk ve parantez toleranslı. */
const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()\-.]/g, ""))
  .refine((v) => /^(\+90|0)?5\d{9}$/.test(v) || /^(\+90|0)?\d{10}$/.test(v), {
    message: "Geçerli bir telefon numarası girin (örn. 0555 123 45 67).",
  });

export const inquirySchema = z.object({
  venueId: z.string().uuid(),
  fullName: z
    .string()
    .trim()
    .min(2, "Adınızı ve soyadınızı girin.")
    .max(120, "Ad soyad en fazla 120 karakter olabilir."),
  phone,
  email: z
    .union([z.literal(""), z.string().trim().email("Geçerli bir e-posta adresi girin.")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  eventTypeId: z
    .union([z.literal(""), z.string().uuid()])
    .optional()
    .transform((v) => (v ? v : undefined)),
  eventDate: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih seçin.")])
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine(
      (v) => !v || new Date(v) >= new Date(new Date().toDateString()),
      { message: "Geçmiş bir tarih seçilemez." },
    ),
  guestCount: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(100000)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v))),
  message: z
    .string()
    .trim()
    .max(2000, "Mesaj en fazla 2000 karakter olabilir.")
    .optional()
    .transform((v) => (v ? v : undefined)),
  /**
   * Bal küpü: gerçek kullanıcıya görünmeyen alan. Dolu geldiyse bot demektir;
   * isteği sessizce başarılı gibi cevaplayıp kaydetmiyoruz.
   */
  website: z.string().max(0).optional().or(z.string().optional()),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
