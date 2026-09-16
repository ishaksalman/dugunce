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
  if (ad.length < 3) return NextResponse.json({ venues: [] });

  const db = await getDataSource();
  const venues = await db.adminFindSimilarVenues(ad, sehir || null);
  return NextResponse.json({ venues }, { headers: { "cache-control": "no-store" } });
}
