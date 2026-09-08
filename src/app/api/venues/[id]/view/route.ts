import { NextResponse } from "next/server";
import { recordVenueView } from "@/lib/services/venues";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Görüntülenme sayacı.
 *
 * Sayaç detay sayfasının sunucu bileşeninden artırılamaz: sayfa ISR ile
 * önbelleğe alındığı için kod yalnızca önbellek ıskalarında çalışır ve
 * görüntülenme ciddi şekilde eksik sayılır. Bu yüzden istemciden beacon
 * olarak geliyor.
 *
 * Sayaç günlük toplam olarak tutuluyor (`venue_views`), görüntüleme başına
 * satır yazılmıyor. Yayında olmayan mekan için fonksiyon sessizce hiçbir şey
 * yapmıyor.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id)) {
    return new NextResponse(null, { status: 400 });
  }
  await recordVenueView(id);
  // Beacon cevabı okumuyor; gövde göndermeye gerek yok.
  return new NextResponse(null, { status: 204 });
}
