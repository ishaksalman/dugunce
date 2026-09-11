import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description:
    "DavetMekanı, Türkiye'deki düğün, nişan, kına ve davet mekanlarını tek yerde toplayan ücretsiz bir keşif platformudur.",
  alternates: { canonical: "/hakkimizda" },
};

export default function HakkimizdaPage() {
  return (
    <>
      <h1>Hakkımızda</h1>
      <p>
        {SITE.name}, Türkiye&apos;deki düğün, nişan, kına, söz, sünnet ve tüm
        özel gün mekanlarını tek yerde toplayan bir keşif platformudur.
      </p>

      <h2>Ne yapıyoruz?</h2>
      <p>
        Mekan aramak yorucu bir iş: onlarca sekme, birbirini tutmayan fiyat
        bilgileri, cevapsız telefonlar. Biz bu işi tek yerde topluyoruz —
        şehir, kapasite, bütçe ve ihtiyacınız olan hizmetlere göre filtreleyin,
        beğendiklerinizi karşılaştırın, doğrudan teklif isteyin.
      </p>
      <p>
        Aracı değiliz. Talebiniz doğrudan mekana gider, mekan sizinle kendi
        iletişim kanallarından görüşür. Sizden komisyon almıyoruz.
      </p>

      <h2>Mekan sahipleri için</h2>
      <p>
        Mekanınızı listelemek ücretsiz. Fotoğraflarınızı, kapasitenizi,
        hizmetlerinizi ve fiyat aralığınızı kendiniz yönetirsiniz; gelen
        teklif talepleri doğrudan panelinize düşer.
      </p>
      <p>
        <Link href="/kayit?tur=mekan-sahibi">Mekanınızı ücretsiz ekleyin →</Link>
      </p>

      <h2>Yayına alma süreci</h2>
      <p>
        Listelenen her mekan, yayına çıkmadan önce ekibimiz tarafından
        inceleniyor. Fotoğrafların mekanı gerçekten temsil etmesi ve bilgilerin
        tutarlı olması aradığımız asgari koşullar.
      </p>

      <h2>İletişim</h2>
      <p>
        Soru, öneri ve iş birlikleri için{" "}
        <Link href="/iletisim">iletişim sayfamızı</Link> kullanabilirsiniz.
      </p>
    </>
  );
}
