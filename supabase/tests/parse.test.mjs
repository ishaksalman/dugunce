/**
 * Toplu giriş ayrıştırıcısının testleri.
 *
 * Şema testlerinden AYRI: burada veritabanı yok, saf fonksiyon sınanıyor.
 * TypeScript kaynağı doğrudan çalıştırmak için Node'un tip sıyırma desteği
 * kullanılıyor (--experimental-strip-types).
 */
import { parseBulkInput, parseMapsUrl, isMapsUrl, cleanMapsUrl,
  parsePlacesJson, jsonMu, trimPlacesJson } from "../../src/lib/import/parse.ts";
import { parseImportPayload } from "../../src/lib/import/payload.ts";

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${n}`); };
const bad = (n, m) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${n}\n      \x1b[90m${m}\x1b[0m`); };
const step = (n, fn) => { try { fn(); ok(n); } catch (e) { bad(n, e.message); } };
const esit = (a, b, not = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${not}\n      beklenen: ${JSON.stringify(b)}\n      gelen   : ${JSON.stringify(a)}`);
  }
};

console.log("\n\x1b[1mToplu giriş ayrıştırıcısı\x1b[0m");

step("uzun Maps adresinden ad ve KONUM okunuyor", () => {
  const u = "https://www.google.com/maps/place/%C3%96zer+Event+Organizasyon+Bah%C3%A7e%C5%9Fehir/@41.081782,28.4230073,10.8z/data=!4m6!3m5!1s0x14b5:0x3aa2!8m2!3d41.0908!4d28.6532";
  const r = parseMapsUrl(u);
  esit(r.name, "Özer Event Organizasyon Bahçeşehir");
  // @41.08,28.42 haritanın ORTASI — mekanın konumu değil. Karıştırılmamalı.
  esit([r.latitude, r.longitude], [41.0908, 28.6532], "!3d!4d alınmalı, @ değil");
});

step("koordinatsız adreste konum null dönüyor", () => {
  const r = parseMapsUrl("https://www.google.com/maps/place/Bir+Yer/");
  esit(r.name, "Bir Yer");
  esit([r.latitude, r.longitude], [null, null]);
});

step("Google dışı adres reddediliyor", () => {
  esit(isMapsUrl("https://maps.app.goo.gl/abc"), true);
  esit(isMapsUrl("https://www.google.com/maps/place/x"), true);
  esit(isMapsUrl("https://google.com.kotu.tr/maps"), false);
  esit(isMapsUrl("http://www.google.com/maps"), false, "http kabul edilmemeli");
  esit(isMapsUrl("https://ornek.com/maps"), false);
});

step("oturum parametreleri atılıyor", () => {
  esit(cleanMapsUrl("https://maps.app.goo.gl/x?authuser=0&entry=ttu"),
       "https://maps.app.goo.gl/x");
});

step("alan sırası önemli değil", () => {
  const { rows } = parseBulkInput([
    "Bahçe Davet; 0212 111 22 33; https://maps.app.goo.gl/aaa",
    "https://maps.app.goo.gl/bbb; Söğüt Evi; 05551112233",
    "0216 444 55 66; Üçüncü Salon",
  ].join("\n"));
  esit(rows[0].name, "Bahçe Davet");
  esit(rows[0].phone, "0212 111 22 33");
  esit(rows[0].mapsUrl, "https://maps.app.goo.gl/aaa");
  esit(rows[1].name, "Söğüt Evi");
  esit(rows[1].phone, "05551112233");
  esit(rows[2].name, "Üçüncü Salon");
  esit(rows[2].phone, "0216 444 55 66");
});

step("harf içeren parça telefon sayılmıyor", () => {
  // "No:22" gibi adres parçaları telefona kaymamalı.
  const { rows } = parseBulkInput("Salon; Blv. No:22 34000");
  esit(rows[0].name, "Salon");
  esit(rows[0].phone, null);
});

step("yalnızca bağlantı içeren satır geçerli", () => {
  const { rows } = parseBulkInput("https://maps.app.goo.gl/aaa");
  esit(rows[0].hata, null);
  esit(rows[0].name, null, "ad çözümden gelecek");
});

step("adsız ve bağlantısız satır hata veriyor", () => {
  const { rows } = parseBulkInput("0212 111 22 33");
  esit(rows[0].hata, "Ad ya da Google Maps bağlantısı gerekli.");
});

step("Google dışı bağlantı hata veriyor", () => {
  const { rows } = parseBulkInput("Salon; https://ornek.com/x");
  esit(rows[0].hata, "Yalnızca Google Maps bağlantısı kabul ediliyor.");
});

step("boş satır ve # yorumu atlanıyor", () => {
  const { rows } = parseBulkInput("# Beylikdüzü listesi\n\nSalon A\n\n   \nSalon B");
  esit(rows.length, 2);
  esit(rows.map((r) => r.name), ["Salon A", "Salon B"]);
});

step("limit aşılınca fazlalık raporlanıyor", () => {
  const metin = Array.from({ length: 55 }, (_, i) => `Salon ${i}`).join("\n");
  const { rows, fazlalik } = parseBulkInput(metin, 50);
  esit(rows.length, 50);
  esit(fazlalik, 5);
});

step("satır numarası kaynak sırasını koruyor", () => {
  const { rows } = parseBulkInput("A\nB\nC");
  esit(rows.map((r) => r.satirNo), [1, 2, 3]);
});

step("JSON girdi tanınıyor", () => {
  esit(jsonMu('[{"title":"x"}]'), true);
  esit(jsonMu('  [\n{"title":"x"}]'), true);
  esit(jsonMu("Bahçe Davet; 0212 111 22 33"), false);
});

step("Google Places dökümünden olgular okunuyor", () => {
  const { rows } = parsePlacesJson(JSON.stringify([{
    title: "Ansu Davet Organizasyon",
    address: "Adnan Kahveci, Beylikdüzü/İstanbul",
    phone: "+90 537 958 94 08",
    website: "https://ornek.com",
    placeId: "ChIJc8uPlrxftRQRdBHhLhAYVqk",
    url: "https://www.google.com/maps/search/?api=1&query=x&query_place_id=y",
    categoryName: "Düğün Salonu",
    categories: ["Düğün Salonu", "Etkinlik Mekânı"],
    location: { lat: 41.0003, lng: 28.645 },
    permanentlyClosed: false,
  }]));
  const r = rows[0];
  esit(r.name, "Ansu Davet Organizasyon");
  esit(r.phone, "+90 537 958 94 08");
  esit(r.placeId, "ChIJc8uPlrxftRQRdBHhLhAYVqk");
  esit([r.latitude, r.longitude], [41.0003, 28.645]);
  esit(r.kategori, "Düğün Salonu");
  esit(r.hata, null);
  // Apify'ın `url`'i ARAMA adresi; mekan referansı sorguda duruyor.
  // Sorguyu atmak adresi anlamsız kılardı — kanonik adresi place_id'den
  // kuruyoruz. (Bu, 10 kaydın onunun da seçilemez gelmesine yol açmıştı.)
  esit(r.mapsUrl,
    "https://www.google.com/maps/place/?q=place_id:ChIJc8uPlrxftRQRdBHhLhAYVqk");
});

step("place_id yoksa arama adresi olduğu gibi korunuyor", () => {
  const { rows } = parsePlacesJson(JSON.stringify([{
    title: "Placeidsiz",
    url: "https://www.google.com/maps/search/?api=1&query=Placeidsiz",
  }]));
  esit(rows[0].mapsUrl, "https://www.google.com/maps/search/?api=1&query=Placeidsiz");
});

step("puan ve değerlendirme SAYISI okunuyor, yorum METNİ okunmuyor", () => {
  const { rows } = parsePlacesJson(JSON.stringify([{
    title: "Puanlı Salon",
    totalScore: 4.2,
    reviewsCount: 7279,
    reviews: [{ text: "Harika bir yerdi", reviewerId: "1" }],
  }]));
  const r = rows[0];
  esit(r.puan, 4.2);
  esit(r.puanAdedi, 7279);
  if (JSON.stringify(r).includes("Harika bir yerdi")) throw new Error("yorum metni sızdı");
});

step("geçersiz puan alınmıyor", () => {
  const { rows } = parsePlacesJson(JSON.stringify([
    { title: "A", totalScore: 7 },
    { title: "B", totalScore: "4.2" },
    { title: "C", reviewsCount: -3 },
  ]));
  esit(rows[0].puan, null, "5 üstü puan");
  esit(rows[1].puan, null, "metin puan");
  esit(rows[2].puanAdedi, null, "negatif adet");
});

step("kırpma puan alanlarını KORUYOR", () => {
  const { json } = trimPlacesJson(JSON.stringify([{
    title: "S", totalScore: 4.2, reviewsCount: 100,
    reviews: [{ text: "metin" }],
  }]), 50);
  const g = JSON.parse(json)[0];
  esit(g.totalScore, 4.2);
  esit(g.reviewsCount, 100);
  // "reviews" araması yanlış olurdu: "reviewsCount"un alt dizesi. Yorum
  // METNİNİ arıyoruz.
  if (json.includes('"reviews"')) throw new Error("yorum dizisi kırpmadan geçti");
  if (json.includes("metin")) throw new Error("yorum metni kırpmadan geçti");
});

step("kapalı işletme işaretleniyor", () => {
  const { rows } = parsePlacesJson(JSON.stringify([
    { title: "Kapalı Salon", permanentlyClosed: true },
    { title: "Geçici Kapalı", temporarilyClosed: true },
  ]));
  esit(rows[0].hata, "Google'da kapalı görünüyor.");
  esit(rows[1].hata, "Google'da kapalı görünüyor.");
});

step("telif alanları OKUNMUYOR", () => {
  // Yorum, fotoğraf ve Google'ın editoryal açıklaması bilerek alınmıyor.
  const { rows } = parsePlacesJson(JSON.stringify([{
    title: "Salon",
    description: "Google'ın editoryal açıklaması",
    reviews: [{ text: "Harika bir yerdi" }],
    imageUrls: ["https://lh3.googleusercontent.com/x"],
    ownerUpdates: [{ text: "Kampanyamız var" }],
  }]));
  const anahtarlar = Object.keys(rows[0]);
  for (const yasak of ["description", "reviews", "imageUrls", "ownerUpdates"]) {
    if (anahtarlar.includes(yasak)) throw new Error(`"${yasak}" alanı sızdı`);
  }
  const govde = JSON.stringify(rows[0]);
  if (govde.includes("Harika bir yerdi")) throw new Error("yorum metni sızdı");
  if (govde.includes("googleusercontent")) throw new Error("fotoğraf adresi sızdı");
  if (govde.includes("editoryal")) throw new Error("Google açıklaması sızdı");
});

step("bozuk JSON hata veriyor, çökmüyor", () => {
  esit(parsePlacesJson("{bozuk").hata, "JSON okunamadı.");
  esit(parsePlacesJson('{"dizi":"degil"}').hata, "JSON bir dizi olmalı.");
});

step("JSON limiti de uygulanıyor", () => {
  const cok = JSON.stringify(Array.from({ length: 55 }, (_, i) => ({ title: `S${i}` })));
  const { rows, fazlalik } = parsePlacesJson(cok, 50);
  esit(rows.length, 50);
  esit(fazlalik, 5);
});

step("ham döküm kırpılınca telif alanları ATILIYOR", () => {
  // Apify çıktısı kayıt başına ~12 KB; yorum ve fotoğraf adresleri sunucuya
  // hiç çıkmamalı. Kırpma tarayıcıda yapılıyor.
  const ham = JSON.stringify([{
    title: "Salon", phone: "0212 111 22 33",
    placeId: "ChIJx", location: { lat: 41, lng: 28 },
    description: "Google editoryal metni",
    reviews: [{ text: "Harika bir yerdi", reviewerId: "123" }],
    imageUrls: ["https://lh3.googleusercontent.com/a", "https://lh3.googleusercontent.com/b"],
    openingHours: [{ day: "Pazartesi", hours: "09:00 to 23:00" }],
    popularTimesHistogram: { Pazartesi: [1, 2, 3] },
    ownerUpdates: [{ text: "Kampanya" }],
  }]);
  const { json, okunan, alinan, hata } = trimPlacesJson(ham, 50);
  esit(hata, null);
  esit([okunan, alinan], [1, 1]);
  for (const yasak of ["reviews", "imageUrls", "description", "ownerUpdates",
                       "openingHours", "popularTimesHistogram",
                       "Harika bir yerdi", "googleusercontent"]) {
    if (json.includes(yasak)) throw new Error(`"${yasak}" kırpmadan geçti`);
  }
  // Gerekli alanlar duruyor.
  const geri = JSON.parse(json)[0];
  esit(geri.title, "Salon");
  esit(geri.placeId, "ChIJx");
  esit(geri.location, { lat: 41, lng: 28 });
});

step("kırpma boyutu ciddi şekilde düşürüyor", () => {
  const kayit = {
    title: "S", placeId: "x", location: { lat: 1, lng: 2 },
    reviews: Array.from({ length: 20 }, (_, i) => ({ text: "y".repeat(200), id: i })),
    imageUrls: Array.from({ length: 30 }, (_, i) => `https://lh3.googleusercontent.com/${i}`),
  };
  const ham = JSON.stringify([kayit, kayit, kayit]);
  const { json } = trimPlacesJson(ham, 50);
  if (json.length >= ham.length / 10) {
    throw new Error(`yeterince küçülmedi: ${ham.length} → ${json.length}`);
  }
});

step("kırpmada limit uygulanıyor ve okunan sayısı raporlanıyor", () => {
  const cok = JSON.stringify(Array.from({ length: 120 }, (_, i) => ({ title: `S${i}` })));
  const { okunan, alinan } = trimPlacesJson(cok, 50);
  esit([okunan, alinan], [120, 50]);
});

step("bozuk dosya kırpmada da çökmüyor", () => {
  esit(trimPlacesJson("{bozuk").hata, "JSON okunamadı.");
  esit(trimPlacesJson('{"a":1}').hata, "JSON bir dizi olmalı.");
});

console.log("\n\x1b[1mAktarım yükü ayrıştırıcısı\x1b[0m");

step("alanlar okunuyor, bilinmeyenler yok sayılıyor", () => {
  const { rows, hata } = parseImportPayload(JSON.stringify([{
    name: "Bahçe Davet",
    sourceUrl: "https://ornek.com/isletme/12",
    phone: "0212 111 22 33",
    address: "Örnek Mah.",
    website: "https://ornek.com",
    placeId: "ChIJx",
    latitude: 41.0003,
    longitude: 28.645,
    imageUrls: ["https://ornek.com/1.jpg", "https://ornek.com/2.jpg"],
    bilinmeyenAlan: "taşınmamalı",
    reviews: [{ text: "yorum" }],
  }]));
  esit(hata, null);
  const r = rows[0];
  esit(r.name, "Bahçe Davet");
  esit(r.sourceUrl, "https://ornek.com/isletme/12");
  esit([r.latitude, r.longitude], [41.0003, 28.645]);
  esit(r.imageUrls.length, 2);
  esit(r.hata, null);
  const govde = JSON.stringify(r);
  if (govde.includes("taşınmamalı")) throw new Error("bilinmeyen alan taşındı");
  if (govde.includes("yorum")) throw new Error("yorum taşındı");
});

step("adsız satır hata veriyor", () => {
  const { rows } = parseImportPayload(JSON.stringify([{ phone: "0212 111 22 33" }]));
  esit(rows[0].hata, "İşletme adı gerekli.");
  esit(rows[0].name, null);
});

step("geçersiz görsel adresi eleniyor ve raporlanıyor", () => {
  const { rows } = parseImportPayload(JSON.stringify([{
    name: "Salon",
    imageUrls: ["https://ok.com/1.jpg", "dosya.jpg", "", null, 42, "ftp://x/y.jpg"],
  }]));
  esit(rows[0].imageUrls, ["https://ok.com/1.jpg"]);
  esit(rows[0].hata, "5 görsel adresi geçersiz, atlandı.");
});

step("tekrar eden görsel adresi bir kez alınıyor", () => {
  const { rows } = parseImportPayload(JSON.stringify([{
    name: "Salon",
    imageUrls: ["https://ok.com/1.jpg", "https://ok.com/1.jpg", "https://ok.com/2.jpg"],
  }]));
  esit(rows[0].imageUrls.length, 2);
});

step("aralık dışı koordinat null oluyor", () => {
  const { rows } = parseImportPayload(JSON.stringify([
    { name: "A", latitude: 999, longitude: 28 },
    { name: "B", latitude: "41", longitude: 28 },
  ]));
  esit(rows[0].latitude, null, "enlem aralık dışı");
  esit(rows[1].latitude, null, "metin enlem sayı değil");
});

step("bozuk yük çökmüyor", () => {
  esit(parseImportPayload("{bozuk").hata, "JSON okunamadı.");
  esit(parseImportPayload('{"a":1}').hata, "JSON bir dizi olmalı.");
  esit(parseImportPayload("[null, 5]").rows.length, 2, "boş öğeler hata satırı olur");
});

step("limit uygulanıyor", () => {
  const cok = JSON.stringify(Array.from({ length: 60 }, (_, i) => ({ name: `S${i}` })));
  const { rows, fazlalik } = parseImportPayload(cok, 50);
  esit([rows.length, fazlalik], [50, 10]);
});

console.log(fail
  ? `\n\x1b[31m${fail} test başarısız\x1b[0m, ${pass} başarılı\n`
  : `\n\x1b[32mTüm testler geçti\x1b[0m (${pass})\n`);
process.exit(fail ? 1 : 0);
