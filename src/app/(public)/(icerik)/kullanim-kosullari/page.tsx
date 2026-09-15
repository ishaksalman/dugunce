import type { Metadata } from "next";
import Link from "next/link";
import { DESTEK_EPOSTA, SITE } from "@/lib/constants";

/**
 * DİKKAT — hukuki incelemeden geçmedi. Yayın öncesi avukata okutun.
 * Metin platformun gerçek işleyişine göre yazıldı; kod değişirse metin de
 * değişmeli.
 */
export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description: `${SITE.name} kullanım koşulları: platformun işleyişi, mekan sahiplerinin ve kullanıcıların sorumlulukları.`,
  alternates: { canonical: "/kullanim-kosullari" },
};

const GUNCELLEME = "9 Eylül 2026";

export default function KullanimKosullariPage() {
  return (
    <>
      <h1>Kullanım Koşulları</h1>
      <p className="ust-bilgi">Son güncelleme: {GUNCELLEME}</p>

      <p>
        {SITE.ekli.belirtme} kullanarak bu koşulları kabul etmiş olursunuz.
        Katılmıyorsanız lütfen platformu kullanmayın.
      </p>

      <h2>1. Platformun rolü</h2>
      <p>
        {SITE.name} bir <strong>keşif ve iletişim platformudur</strong>. Mekan
        kiralama sözleşmesinin tarafı değiliz, rezervasyon yapmıyoruz, ödeme
        almıyoruz ve aracılık hizmeti sunmuyoruz.
      </p>
      <p>
        Teklif talebiniz doğrudan mekana iletilir. Bundan sonraki görüşme,
        fiyat pazarlığı, sözleşme ve ödeme tamamen sizinle mekan arasındadır.
        Bu süreçte doğabilecek uyuşmazlıklardan {SITE.name} sorumlu değildir.
      </p>

      <h2>2. Mekan bilgilerinin doğruluğu</h2>
      <p>
        Mekan sayfalarındaki fotoğraf, kapasite, fiyat ve hizmet bilgileri{" "}
        <strong>mekan sahipleri tarafından girilir</strong>. Yayına almadan önce
        inceleme yapıyoruz, ancak bilgilerin güncelliğini ve doğruluğunu
        garanti edemeyiz.
      </p>
      <p>
        Fiyatlar bilgilendirme amaçlıdır ve bağlayıcı değildir; kesin fiyat
        mekanın size vereceği tekliftir. Yanlış bilgiyle karşılaşırsanız{" "}
        <Link href="/iletisim">bize bildirin</Link>.
      </p>

      <h2>3. Kullanıcı yükümlülükleri</h2>
      <ul>
        <li>Teklif taleplerinde gerçek iletişim bilgilerinizi kullanın.</li>
        <li>
          Platformu spam, taciz, sahte talep veya otomatik toplu istek göndermek
          için kullanmayın.
        </li>
        <li>
          Mekan içeriklerini izinsiz kopyalamayın veya ticari amaçla yeniden
          yayınlamayın.
        </li>
      </ul>
      <p>
        Kötüye kullanım tespit edersek talebi engelleyebilir, hesabı
        kapatabiliriz.
      </p>

      <h2>4. Mekan sahiplerinin yükümlülükleri</h2>
      <ul>
        <li>
          Yüklediğiniz fotoğrafların <strong>kendi mekanınıza ait</strong>{" "}
          olduğunu ve yayınlama hakkına sahip olduğunuzu beyan edersiniz.
        </li>
        <li>Kapasite, fiyat ve hizmet bilgilerini güncel tutun.</li>
        <li>
          Gelen teklif taleplerine makul sürede dönüş yapın; talep sahibinin
          bilgilerini yalnızca bu amaçla kullanın.
        </li>
        <li>
          Başkasına ait mekanı kendi adınıza listelemeyin.
        </li>
      </ul>
      <p>
        Bu koşullara aykırılık hâlinde mekanınızı yayından kaldırabilir veya
        hesabınızı kapatabiliriz. Yayından kaldırma durumunda gerekçesini
        panelinizde görürsünüz.
      </p>

      <h2>5. İçerik hakları</h2>
      <p>
        Yüklediğiniz fotoğraf ve metinlerin hakları size aittir. Bunları
        platformda ve platformun tanıtımında yayınlayabilmemiz için bize
        <strong> münhasır olmayan</strong> bir kullanım izni vermiş olursunuz.
        Mekanınızı yayından kaldırdığınızda bu izin sona erer.
      </p>

      <h2>6. Hizmetin sürekliliği</h2>
      <p>
        Platformu kesintisiz sunmaya çalışıyoruz ancak bakım, teknik arıza veya
        üçüncü taraf altyapı sorunları nedeniyle geçici kesintiler olabilir.
        Bu kesintilerden doğan dolaylı zararlardan sorumlu değiliz.
      </p>

      <h2>7. Ücretlendirme</h2>
      <p>
        Mekan listeleme şu anda ücretsizdir ve teklif talepleri için komisyon
        alınmaz. İleride ücretli özellikler sunarsak, mevcut ücretsiz
        özellikleri kaldırmadan önce hesap sahiplerine önceden bildiririz.
      </p>

      <h2>8. Değişiklikler ve iletişim</h2>
      <p>
        Bu koşulları güncelleyebiliriz; yukarıdaki tarih değişir. Sorularınız
        için <a href={`mailto:${DESTEK_EPOSTA}`}>{DESTEK_EPOSTA}</a>.
      </p>
      <p>
        Kişisel verilerinizin işlenmesiyle ilgili bilgi için{" "}
        <Link href="/gizlilik">gizlilik politikamıza</Link> bakın.
      </p>
    </>
  );
}
