import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

/**
 * Katalog girişinde "bunu zaten eklemiş miyim?" kontrolü.
 *
 * Sunucu eylemi değil uç nokta: kullanıcı yazarken çağrılıyor ve sunucu
 * eylemleri sırayla kuyruklanıp formu yavaşlatıyor.
 */
export async function GET(request: Request) {
  await requireRole(["admin"]);

  const { searchParams } = new URL(request.url);
  const ad = (searchParams.get("ad") ?? "").trim();
  const sehir = searchParams.get("sehir");
  const tel = (searchParams.get("tel") ?? "").trim();
  // Telefon tek başına yeterli sinyal; ad kısa olsa bile sorulabilir.
  if (ad.length < 3 && tel.length < 7) return NextResponse.json({ venues: [] });

  const db = await getDataSource();
  const venues = await db.adminFindSimilarVenues(ad, sehir || null, tel || null);
  return NextResponse.json({ venues }, { headers: { "cache-control": "no-store" } });
}
