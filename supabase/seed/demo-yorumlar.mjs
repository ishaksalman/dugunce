/**
 * Demo yorumlar. Yorum bölümünün gerçek metinlerle nasıl göründüğünü
 * doğrulamak için; hepsi APPROVED olarak eklenir.
 *
 * `mekan` alanı mekan slug'ı. Bir kullanıcı bir mekana yalnızca bir kez
 * yorum yazabildiği için (unique kısıt) her satır ayrı bir demo müşteriye
 * atanıyor.
 */
export const DEMO_YORUMLAR = [
  { mekan: "bahce-davet", puan: 5, yazar: "Elif Kaya", baslik: "Hayalimizdeki düğün",
    metin: "Ağustos düğünümüzü burada yaptık. Bahçe düzeni ve akşam aydınlatması gerçekten çok güzeldi. Ekip gün boyu ilgiliydi, hiçbir aksaklık yaşamadık. 380 kişiydik, sıkışıklık olmadı." },
  { mekan: "bahce-davet", puan: 4, yazar: "Murat Demir", baslik: "Güzel mekan, otopark biraz dar",
    metin: "Mekan ve servis çok iyiydi, yemekler beğenildi. Tek eksik davetli sayımıza göre otoparkın yetersiz kalmasıydı, misafirlerin bir kısmı sokağa park etti. Onun dışında memnun kaldık." },
  { mekan: "bahce-davet", puan: 5, yazar: "Zeynep Arslan", baslik: "Fotoğraflar muhteşem çıktı",
    metin: "Gün batımında bahçenin ışığı inanılmazdı, fotoğrafçımız çok memnun kaldı. Gelin odası ferah ve temizdi. Fiyat performans olarak da bölgedeki alternatiflerden iyiydi." },

  { mekan: "nisan-balo-salonu", puan: 5, yazar: "Ahmet Yıldız", baslik: "Kış düğünü için ideal",
    metin: "Ocak ayında nişan yaptık, salon çok sıcak ve ferahtı. Tavan yüksekliği kalabalık hissi vermiyor. Vale hizmeti misafirler için büyük kolaylıktı." },
  { mekan: "nisan-balo-salonu", puan: 4, yazar: "Selin Öztürk", baslik: "Servis hızlı, müzik sistemi iyi",
    metin: "250 kişilik nişanımızda servis çok hızlıydı. Ses sistemi kaliteli. Salonun dekorasyonu biraz klasik kalıyor ama kendi süslememizi yapmamıza izin verdiler." },

  { mekan: "alacati-bag-evi", puan: 5, yazar: "Deniz Şahin", baslik: "Ege'de bundan güzeli yok",
    metin: "Taş avlu ve zeytin ağaçları arasında bir düğün hayal ediyorsanız burası tam yeri. Menü tamamen bize göre kurgulandı, yerel ürünler kullanıldı. Misafirlerimiz hâlâ konuşuyor." },
  { mekan: "alacati-bag-evi", puan: 5, yazar: "Can Aydın", baslik: "Erken rezervasyon şart",
    metin: "Temmuz için sekiz ay önceden yer ayırttık, doğru karar olmuş. Alan 200 kişide bile rahat. Konaklama için çevredeki otellerle anlaşmaları var, misafirlerimiz zorlanmadı." },

  { mekan: "konyaalti-beach-davet", puan: 5, yazar: "Merve Çelik", baslik: "Ayakları kumda nikah",
    metin: "Nikahı denize sıfır kıldık, gün batımına denk geldi. Organizasyon ekibi saat planını dakikası dakikasına uyguladı. Antalya'da açık hava düğünü düşünen herkese öneririm." },
  { mekan: "konyaalti-beach-davet", puan: 4, yazar: "Emre Koç", baslik: "Harika ama rüzgara dikkat",
    metin: "Mekan ve manzara kusursuz. Eylül akşamı rüzgar biraz sertti, masa süslemelerinin bir kısmı uçtu. Ekip hızlı müdahale etti ama rüzgar perdesi konusunu sormanızı öneririm." },

  { mekan: "nilufer-garden", puan: 5, yazar: "Büşra Aksoy", baslik: "Yağmura karşı kapalı alan can kurtardı",
    metin: "Düğün günü beklenmedik yağmur başladı, organizasyonu bir saat içinde kapalı salona taşıdılar. Hazırlıklı olmaları bizi kurtardı. Uludağ manzarası da ayrı güzeldi." },
  { mekan: "nilufer-garden", puan: 4, yazar: "Okan Polat", baslik: "Fiyat performans iyi",
    metin: "Bursa'da bu kapasitede daha uygun bir yer bulmak zor. Yemekler iyiydi, servis biraz yavaştı ama 400 kişi için normal karşıladık." },

  { mekan: "sapanca-gol-evi", puan: 5, yazar: "İrem Güneş", baslik: "İstanbul'dan gelen misafirler için ideal",
    metin: "Şehirden bir saat uzakta ama başka bir dünya. Göl kenarındaki nikah alanı çok özeldi. Misafirlerimizin çoğu geceyi çevrede geçirdi, mekan konaklama önerilerinde yardımcı oldu." },
  { mekan: "sapanca-gol-evi", puan: 5, yazar: "Barış Erdoğan", baslik: "Sonbaharda ayrı güzel",
    metin: "Ekim ayında nişan yaptık, ormanın rengi inanılmazdı. 180 kişiydik, alan tam oturdu. Isıtıcılar sayesinde akşam üşümedik." },

  { mekan: "bogaz-teras", puan: 5, yazar: "Ceren Tunç", baslik: "Manzara her şeyi anlatıyor",
    metin: "Boğaz manzarası karşısında kimse fotoğraf çekmekten yemeğe sıra bulamadı. Alanı tek bize tahsis etmeleri çok önemliydi, kalabalık hissi hiç olmadı." },

  { mekan: "urla-zeytinlik", puan: 4, yazar: "Gökhan Işık", baslik: "Doğal ve sade",
    metin: "Aşırı süslemeden uzak, doğal bir düğün istiyorsanız burası uygun. Zeytinliğin içindeki nikah alanı çok hoştu. Yol biraz dar, misafirlere tarif göndermeyi unutmayın." },

  { mekan: "cankaya-davet", puan: 4, yazar: "Pınar Doğan", baslik: "Merkezi konum büyük avantaj",
    metin: "Ankara'nın göbeğinde olması yaşlı misafirlerimiz için çok iyiydi. Salon 2023'te yenilenmiş, temiz ve modern. Otopark kapasitesi kalabalık düğünlerde sıkışabiliyor." },

  { mekan: "odunpazari-konak-davet", puan: 5, yazar: "Nazlı Kurt", baslik: "Küçük ve samimi bir nişan",
    metin: "120 kişilik nişanımız için tarihi konak muhteşem bir atmosfer sundu. Avlu ve iç mekan birlikte kullanıldı. Fotoğraf için Odunpazarı sokakları hazır dekor gibi." },

  { mekan: "sogut-bahce-davet", puan: 5, yazar: "Hakan Yalçın", baslik: "Bilecik'te en bakımlı yer",
    metin: "Çevredeki alternatiflere göre çok daha bakımlı. Aydınlatma yenilenmiş, akşam çok hoş duruyor. Otopark geniş, ilçe dışından gelen misafirler rahat etti." },
];
