import { NextResponse } from "next/server";
import { getVenuesByIds } from "@/lib/services/venues";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Favori listesindeki mekanların kart verisi.
 *
 * Favoriler tarayıcıda tutulduğu için sunucu hangi id'lerin istendiğini
 * ancak istemciden öğrenebiliyor. Yalnızca yayındaki mekanlar döner.
 */
export async function GET(request: Request) {
  const ham = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = ham.split(",").map((s) => s.trim()).filter((s) => UUID.test(s)).slice(0, 200);

  if (ids.length === 0) return NextResponse.json({ venues: [] });

  try {
    const venues = await getVenuesByIds(ids);
    return NextResponse.json({ venues });
  } catch (error) {
    console.error("[api/venues/by-ids]", error);
    return NextResponse.json({ error: "Mekanlar yüklenemedi" }, { status: 500 });
  }
}
