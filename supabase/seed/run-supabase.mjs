/**
 * Seed'i gerçek Supabase veritabanına uygular.
 *
 *   DATABASE_URL="postgresql://postgres:...@db.<proje>.supabase.co:5432/postgres" \
 *   npm run seed
 *
 * Demo mekan sahibi hesapları auth.users'a doğrudan yazılmaz; Supabase'in
 * kendi admin API'si üzerinden oluşturulur. Bu yüzden SUPABASE_URL ve
 * SUPABASE_SERVICE_ROLE_KEY de gerekiyor.
 *
 * DİKKAT: --demo bayrağı olmadan yalnızca taksonomi (il/ilçe/tür/özellik)
 * yüklenir. Demo mekanlar üretime asla girmemeli.
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { seedTaksonomi, seedDemoMekanlar, seedDemoYorumlar } from "./apply.mjs";

const { DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
// Uygulama `NEXT_PUBLIC_SUPABASE_URL` kullanıyor; ikisini de kabul ediyoruz.
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const demoIstendi = process.argv.includes("--demo");

if (!DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil. Supabase → Project Settings → Database → Connection string.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});
await client.connect();
const q = (sql, params) => client.query(sql, params);

console.log("Taksonomi yükleniyor…");
console.log(await seedTaksonomi(q));

if (demoIstendi) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Demo mekanlar için NEXT_PUBLIC_SUPABASE_URL (veya SUPABASE_URL) ve\n" +
      "SUPABASE_SERVICE_ROLE_KEY gerekli.",
    );
    await client.end();
    process.exit(1);
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ownerIds = [];
  for (let i = 1; i <= 3; i++) {
    const email = `demo-sahip-${i}@davetmekani.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: `Demo Mekan Sahibi ${i}` },
    });
    if (error && !error.message.includes("already been registered")) throw error;
    if (data?.user) {
      ownerIds.push(data.user.id);
    } else {
      const { rows } = await q("select id from auth.users where email = $1", [email]);
      ownerIds.push(rows[0].id);
    }
  }
  await q("update public.profiles set role = 'venue_owner' where id = any($1)", [ownerIds]);

  console.log("Demo mekanlar yükleniyor…");
  console.log(await seedDemoMekanlar(q, ownerIds));


  console.log("Demo yorumlar yükleniyor…");
  const reviewerCache = new Map();
  console.log(await seedDemoYorumlar(q, async (i, adSoyad) => {
    const email = `demo-yorumcu-${i + 1}@davetmekani.test`;
    if (reviewerCache.has(email)) return reviewerCache.get(email);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: adSoyad },
    });
    if (error && !error.message.includes("already been registered")) throw error;
    let id = data?.user?.id;
    if (!id) {
      const { rows } = await q("select id from auth.users where email = $1", [email]);
      id = rows[0].id;
    }
    reviewerCache.set(email, id);
    return id;
  }));
} else {
  console.log("Demo mekanlar atlandı (--demo bayrağı verilmedi).");
}

await client.end();
console.log("Tamamlandı.");
