import { NextResponse } from "next/server";
import { getDistricts } from "@/lib/services/taxonomy";

/**
 * Seçilen şehrin ilçeleri. Filtre panelinde şehir değişince çağrılır —
 * 423 ilçenin tamamını her sayfaya gömmek yerine talep üzerine getiriyoruz.
 */
export async function GET(request: Request) {
  const citySlug = new URL(request.url).searchParams.get("sehir");
  if (!citySlug || !/^[a-z0-9-]{1,80}$/.test(citySlug)) {
    return NextResponse.json({ error: "Geçersiz şehir" }, { status: 400 });
  }

  try {
    const districts = await getDistricts(citySlug);
    return NextResponse.json(
      { districts: districts.map((d) => ({ slug: d.slug, name: d.name, count: d.venue_count })) },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    console.error("[api/taxonomy/districts]", error);
    return NextResponse.json({ error: "İlçeler yüklenemedi" }, { status: 500 });
  }
}
