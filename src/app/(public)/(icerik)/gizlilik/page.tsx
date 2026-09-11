import type { Metadata } from "next";
import Link from "next/link";
import { DESTEK_EPOSTA, SITE } from "@/lib/constants";

/**
 * KVKK aydınlatma metni.
 *
 * DİKKAT — bu metin sistemin GERÇEK davranışına göre yazıldı (hangi alan
 * toplanıyor, nereye gidiyor, ne kadar saklanıyor) ama HUKUKİ İNCELEMEDEN
 * GEÇMEDİ. Yayına çıkmadan önce bir avukata okutun; özellikle veri saklama
 * süreleri, veri sorumlusu unvanı ve açık rıza gereken durumlar.
 *
 * Metni değiştirirken koda da bakın: burada yazan her şey kodda karşılığı
 * olan bir davranış. Kod değişirse metin de değişmeli.
 */
export const metadata: Metadata = {
  title: "Gizlilik Politikası ve KVKK Aydınlatma Metni",
  description:
    "DavetMekanı'nda hangi kişisel verileri topluyoruz, neden topluyoruz, kiminle paylaşıyoruz ve haklarınız neler.",
  alternates: { canonical: "/gizlilik" },
};

const GUNCELLEME = "9 Eylül 2026";

export default function GizlilikPage() {
  return (
    <>
      <h1>Gizlilik Politikası ve KVKK Aydınlatma Metni</h1>
      <p className="ust-bilgi">Son güncelleme: {GUNCELLEME}</p>

      <p>
        Bu metin, {SITE.name} olarak hangi kişisel verileri topladığımızı, neden
        topladığımızı, kimlerle paylaştığımızı ve 6698 sayılı Kişisel Verilerin
        Korunması Kanunu (KVKK) kapsamındaki haklarınızı açıklar.
      </p>

      <h2>1. Hangi verileri topluyoruz?</h2>

      <h3>Teklif talebi gönderdiğinizde</h3>
      <p>
        Formda girdiğiniz <strong>ad soyad</strong> ve <strong>telefon</strong>{" "}
        zorunludur. <strong>E-posta</strong>, <strong>etkinlik türü</strong>,{" "}
        <strong>etkinlik tarihi</strong>, <strong>kişi sayısı</strong> ve{" "}
        <strong>mesajınız</strong> isteğe bağlıdır. Bu bilgiler talebinizi
        ilettiğiniz mekana ulaştırılır.
      </p>

      <h3>Otomatik toplanan teknik veriler</h3>
      <p>
        Spam ve kötüye kullanımı engellemek için IP adresinizin ve tarayıcı
        bilginizin <strong>tuzlanmış özeti</strong> (hash) saklanır.{" "}
        <strong>Ham IP adresiniz ve tarayıcı bilginiz kaydedilmez</strong>; bu
        özetlerden kimliğiniz geri getirilemez. Yalnızca &quot;aynı ziyaretçi
        saatte üçten fazla talep göndermiş mi&quot; sorusunu cevaplamak için
        kullanılır.
      </p>

      <h3>Mekan sahibi hesabı açtığınızda</h3>
      <p>
        <strong>Ad soyad</strong>, <strong>e-posta</strong> ve isteğe bağlı{" "}
        <strong>telefon</strong>. Parolanız bize şifrelenmiş olarak ulaşır ve
        açık hâlini hiçbir zaman görmeyiz.
      </p>

      <h3>Favorileriniz</h3>
      <p>
        Beğendiğiniz mekanlar <strong>yalnızca kendi tarayıcınızda</strong>{" "}
        saklanır (localStorage). Bu bilgi sunucularımıza gönderilmez, bizde
        kaydı yoktur. Tarayıcı verilerinizi temizlerseniz favorileriniz de
        silinir.
      </p>

      <h3>Görüntülenme istatistikleri</h3>
      <p>
        Mekan sayfalarının günlük görüntülenme <strong>toplamını</strong>{" "}
        tutuyoruz. Bu sayaç kişiye bağlı değildir; kimin hangi sayfayı
        gezdiğine dair bir kayıt tutmuyoruz.
      </p>

      <h2>2. Verilerinizi kimlerle paylaşıyoruz?</h2>

      <h3>Talebinizi gönderdiğiniz mekan</h3>
      <p>
        Teklif talebinizin amacı budur: form bilgileriniz ilgili mekanın
        yetkilisine iletilir ve mekan sizinle doğrudan iletişime geçer.
      </p>

      <h3>DavetPro&apos;ya bağlı mekanlar</h3>
      <p>
        Bazı mekanlar, taleplerini <strong>DavetPro</strong> adlı işletme
        yönetim sistemimiz üzerinden takip eder. Böyle bir mekana talep
        gönderdiğinizde form bilgileriniz DavetPro&apos;ya da aktarılır.
        DavetPro ayrı bir sistemdir; aktarım şifreli ve imzalı bağlantı
        üzerinden yapılır.
      </p>

      <h3>Hizmet sağlayıcılarımız</h3>
      <p>
        Veritabanı, kimlik doğrulama ve dosya barındırma için{" "}
        <strong>Supabase</strong> altyapısını kullanıyoruz. Bu sağlayıcı, veri
        işleyen sıfatıyla yalnızca hizmeti sunmak için gereken erişime sahiptir.
      </p>
      <p>
        Verilerinizi bunun dışında hiçbir üçüncü tarafla paylaşmıyor, satmıyor
        ve reklam amacıyla kullandırmıyoruz.
      </p>

      <h2>3. Ne kadar süre saklıyoruz?</h2>
      <ul>
        <li>
          Teklif talepleri, mekanın size dönüş yapabilmesi ve uyuşmazlık hâlinde
          kanıt oluşturması için <strong>3 yıl</strong> saklanır.
        </li>
        <li>
          IP ve tarayıcı özetleri yalnızca hız sınırı için gereklidir;{" "}
          <strong>90 gün</strong> sonra anlamını yitirir.
        </li>
        <li>Hesap bilgileri, hesabınız açık kaldığı sürece saklanır.</li>
      </ul>

      <h2>4. Haklarınız</h2>
      <p>KVKK&apos;nın 11. maddesi uyarınca:</p>
      <ul>
        <li>Kişisel verinizin işlenip işlenmediğini öğrenme,</li>
        <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
        <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
        <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
        <li>Silinmesini veya yok edilmesini isteme,</li>
        <li>
          Otomatik sistemlerle analiz sonucu aleyhinize bir sonuç çıkmasına
          itiraz etme,
        </li>
        <li>Kanuna aykırı işleme nedeniyle zarara uğrarsanız tazminat talep etme</li>
      </ul>
      <p>
        haklarına sahipsiniz. Başvurularınızı{" "}
        <a href={`mailto:${DESTEK_EPOSTA}`}>{DESTEK_EPOSTA}</a> adresine
        iletebilirsiniz; en geç 30 gün içinde yanıt veriyoruz.
      </p>

      <h2>5. Çerezler</h2>
      <p>
        Reklam veya takip çerezi kullanmıyoruz. Yalnızca oturum açtığınızda
        kimliğinizi doğrulayan <strong>zorunlu çerezler</strong> ve
        favorilerinizi tuttuğunuz tarayıcı depolaması kullanılır. Bunlar
        olmadan giriş yapma ve favori ekleme çalışmaz.
      </p>

      <h2>6. Değişiklikler</h2>
      <p>
        Bu metni güncellersek yukarıdaki &quot;son güncelleme&quot; tarihini
        değiştiririz. Önemli değişikliklerde hesap sahiplerine e-posta ile
        bilgi veririz.
      </p>

      <p>
        Ayrıca <Link href="/kullanim-kosullari">kullanım koşullarımıza</Link>{" "}
        da bakabilirsiniz.
      </p>
    </>
  );
}
