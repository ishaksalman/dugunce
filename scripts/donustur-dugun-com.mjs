/**
 * dugun.com kazıyıcısının (Apify) JSON çıktısını, sürücü ekranının
 * (`/yonetim/ice-aktarma/yeni`) beklediği yük biçimine çevirir.
 *
 * Kullanım:
 *   npm run donustur:dugun-com -- girdi.json cikti.json
 *
 * `girdi.json` Apify dataset export'u (bir dizi kayıt). `cikti.json` sürücü
 * ekranına doğrudan yapıştırılabilecek JSON'u yazar. Ağ ve veritabanı yok —
 * yalnızca alan eşlemesi (bkz. src/lib/import/dugun-com.ts).
 */
import { readFile, writeFile } from "node:fs/promises";
import { dugunComToPayload } from "../src/lib/import/dugun-com.ts";

const [, , girdiYolu, ciktiYolu] = process.argv;

if (!girdiYolu || !ciktiYolu) {
  console.error("Kullanım: npm run donustur:dugun-com -- girdi.json cikti.json");
  process.exit(1);
}

const ham = await readFile(girdiYolu, "utf8");
const veri = JSON.parse(ham);

if (!Array.isArray(veri)) {
  console.error("Girdi bir JSON dizisi olmalı (Apify dataset export'u).");
  process.exit(1);
}

const { rows, atlanan } = dugunComToPayload(veri);

await writeFile(ciktiYolu, JSON.stringify(rows, null, 2), "utf8");

console.log(`${rows.length} kayıt yazıldı → ${ciktiYolu}`);
if (atlanan > 0) {
  console.log(`${atlanan} kayıt atlandı (ad yok veya scrape_status="failed").`);
}
console.log("Şimdi bu dosyayı /yonetim/ice-aktarma/yeni ekranına JSON olarak yapıştır — önizleme adımı hiçbir şey yazmaz.");
