import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processSyncQueue } from "@/lib/services/davetpro-sync";

/**
 * Aktarım kuyruğunu işler. Zamanlanmış görev (Vercel Cron vb.) çağırır.
 *
 * Yetki: `CRON_SECRET` başlığı. Bu uç nokta service_role ile veri yazıyor;
 * korumasız bırakılırsa herkes kuyruğu tetikleyebilir.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function yetkili(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const beklenen = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(beklenen);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!yetkili(request)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz." }, { status: 401 });
  }
  try {
    const sonuc = await processSyncQueue(50);
    return NextResponse.json({ ok: true, ...sonuc });
  } catch (error) {
    console.error("[cron/davetpro-sync]", (error as Error).message);
    return NextResponse.json({ ok: false, error: "Sunucu hatası." }, { status: 500 });
  }
}

// Vercel Cron GET ile çağırıyor.
export const GET = POST;
