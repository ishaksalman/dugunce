/**
 * Migration koşucusu — gerçek Supabase veritabanına uygular.
 *
 *   npm run migrate
 *
 * `supabase/migrations/` altındaki dosyaları sıralı çalıştırır ve
 * `public._migrations` tablosunda takip eder; ikinci çalıştırmada yalnızca
 * yeni dosyalar uygulanır. Her dosya kendi işleminde (transaction) çalışır —
 * yarım kalan bir migration şemayı bozmaz.
 *
 * DİKKAT: DATABASE_URL doğrudan bağlantı olmalı (port 5432), pooler değil
 * (6543). Pooler DDL ve advisory lock için uygun değil.
 */
import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MIG_DIR = path.join(HERE, "migrations");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL tanımlı değil.\n" +
    "Supabase → Project Settings → Database → Connection string → URI\n" +
    "Değeri .env.local dosyasına yaz, sonra: npm run migrate",
  );
  process.exit(1);
}

if (DATABASE_URL.includes(":6543")) {
  console.warn(
    "UYARI: pooler bağlantısı (6543) kullanılıyor. Migration için doğrudan " +
    "bağlantı (5432) önerilir.",
  );
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});
await client.connect();

await client.query(`
  create table if not exists public._migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);

// Takip tablosu `public` şemasında olduğu için PostgREST üzerinden dışarı
// açılıyor. İçeriği hassas değil ama API yüzeyinde işi yok: yetkileri geri
// alıp RLS'i açıyoruz (politika yok = kimse okuyamaz).
await client.query(`
  revoke all on public._migrations from anon, authenticated;
  alter table public._migrations enable row level security;
`);

const { rows } = await client.query("select name from public._migrations");
const applied = new Set(rows.map((r) => r.name));
const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
const pending = files.filter((f) => !applied.has(f));

if (pending.length === 0) {
  console.log(`Güncel — ${files.length} migration zaten uygulanmış.`);
  await client.end();
  process.exit(0);
}

console.log(`${pending.length} yeni migration uygulanacak:\n`);
for (const file of pending) {
  process.stdout.write(`  ${file} … `);
  const sql = fs.readFileSync(path.join(MIG_DIR, file), "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public._migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log("\x1b[32mtamam\x1b[0m");
  } catch (error) {
    await client.query("rollback");
    console.log("\x1b[31mBAŞARISIZ\x1b[0m");
    console.error(`\n${error.message}\n`);
    console.error("Bu migration geri alındı; önceki migration'lar uygulanmış durumda.");
    await client.end();
    process.exit(1);
  }
}

console.log(`\n${pending.length} migration uygulandı.`);
await client.end();
