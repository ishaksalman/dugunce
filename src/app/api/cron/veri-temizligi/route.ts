import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Saklama süresi dolan verileri temizler.
 *
 * /gizlilik sayfasında ilan ettiğimiz süreleri bu iş uyguluyor. Metinde
 * yazıp uygulamamak KVKK açısından sorun; bu yüzden günlük çalışıyor.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function yetkili(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!yetkili(request)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz." }, { status: 401 });
  }
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("purge_expired_data");
    if (error) throw new Error(error.message);
    console.log("[cron/veri-temizligi]", JSON.stringify(data));
    return NextResponse.json({ ok: true, ...(data as object) });
  } catch (error) {
    console.error("[cron/veri-temizligi]", (error as Error).message);
    return NextResponse.json({ ok: false, error: "Sunucu hatası." }, { status: 500 });
  }
}

export const GET = POST;
