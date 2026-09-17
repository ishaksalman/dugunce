/**
 * Toplu giriş ayrıştırıcısının testleri.
 *
 * Şema testlerinden AYRI: burada veritabanı yok, saf fonksiyon sınanıyor.
 * TypeScript kaynağı doğrudan çalıştırmak için Node'un tip sıyırma desteği
 * kullanılıyor (--experimental-strip-types).
 */
import { parseBulkInput, parseMapsUrl, isMapsUrl, cleanMapsUrl }
  from "../../src/lib/import/parse.ts";

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

console.log(fail
  ? `\n\x1b[31m${fail} test başarısız\x1b[0m, ${pass} başarılı\n`
  : `\n\x1b[32mTüm testler geçti\x1b[0m (${pass})\n`);
process.exit(fail ? 1 : 0);
