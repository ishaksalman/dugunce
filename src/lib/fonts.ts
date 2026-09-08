import { Fraunces, Inter } from "next/font/google";

/**
 * Türkçe karakterler (ı, İ, ğ, Ş, ç, ö, ü) `latin-ext` alt kümesinde.
 * Her iki ailede de bu alt küme zorunlu — atlanırsa tarayıcı yedek fonta
 * düşer ve başlıklarda karakterler farklı görünür.
 */
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Fraunces değişken bir font; `opsz` ekseni olmadan büyük puntoda fazla
 * kalın durur. `SOFT` ve `WONK` eksenleri 0'da tutularak süslülük kapatılır.
 */
export const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});
