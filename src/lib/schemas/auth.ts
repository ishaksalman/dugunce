import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "E-posta adresinizi girin.")
  .email("Geçerli bir e-posta adresi girin.")
  .transform((v) => v.toLowerCase());

/**
 * Supabase varsayılan olarak en az 6 karakter istiyor; 8'e çıkarıyoruz.
 * Karmaşıklık kuralı (büyük harf, rakam…) koymuyoruz: kullanıcıları
 * "Parola1!" gibi tahmin edilebilir kalıplara itiyor, uzunluk daha etkili.
 */
const password = z
  .string()
  .min(8, "Parola en az 8 karakter olmalı.")
  .max(72, "Parola en fazla 72 karakter olabilir.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Parolanızı girin."),
});

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Adınızı ve soyadınızı girin.")
    .max(120, "Ad soyad en fazla 120 karakter olabilir."),
  email,
  password,
  phone: z
    .union([
      z.literal(""),
      z.string().trim().transform((v) => v.replace(/[\s()\-.]/g, "")),
    ])
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || /^(\+90|0)?5\d{9}$/.test(v), {
      message: "Geçerli bir cep telefonu girin (örn. 0555 123 45 67).",
    }),
  // Mekan sahibi olarak kayıt akışından mı geliyor?
  asOwner: z.coerce.boolean().optional(),
});

export const resetRequestSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Parolalar eşleşmiyor.",
    path: ["passwordConfirm"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
