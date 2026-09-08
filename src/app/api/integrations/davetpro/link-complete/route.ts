import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { dogrula } from "@/lib/integrations/signature";
import { processSyncQueue } from "@/lib/services/davetpro-sync";

/**
 * DavetPro'ya geçiş (handoff) tamamlandığında DavetPro bu uç noktayı çağırır
 * ve hangi DavetMekanı mekanının hangi DavetPro salonuna karşılık geldiğini
 * bildirir.
 *
 * Kontrat: docs/DAVETPRO-ENTEGRASYON.md → Uç nokta 3
 */

const bodySchema = z.object({
  v: z.literal(1),
  business_id: z.string().uuid(),
  mappings: z
    .array(
      z.object({
        davetmekani_venue_id: z.string().uuid(),
        davetpro_venue_id: z.string().uuid().nullish(),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request) {
  const raw = await request.text();

  const imza = dogrula(raw, request.headers, process.env.DAVETPRO_INTEGRATION_SECRET);
  if (!imza.ok) {
    return NextResponse.json({ ok: false, error: imza.mesaj }, { status: imza.kod });
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ ok: false, error: "Gövde JSON değil." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Geçersiz gövde." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const sonuclar: { venue_id: string; queued: number }[] = [];

  for (const m of parsed.data.mappings) {
    // Bağlama ve geçmiş aktarımı aynı fonksiyonda: DavetMekanı panelinden
    // kod ile bağlanmakla handoff ile bağlanmak aynı kod yolunu kullanıyor.
    const { data, error } = await supabase.rpc("link_venue_to_davetpro", {
      p_venue_id: m.davetmekani_venue_id,
      p_business_id: parsed.data.business_id,
      p_davetpro_venue_id: m.davetpro_venue_id ?? null,
    });
    if (error) {
      console.error("[link-complete]", m.davetmekani_venue_id, error.message);
      continue;
    }
    const r = data as { queued_inquiries: number };
    sonuclar.push({ venue_id: m.davetmekani_venue_id, queued: r.queued_inquiries });
  }

  // Geçmiş aktarımını beklemeden başlat; kullanıcı DavetPro'ya döndüğünde
  // talepleri orada bulsun.
  void processSyncQueue(100).catch((e) =>
    console.error("[link-complete] kuyruk", (e as Error).message),
  );

  return NextResponse.json({ ok: true, linked: sonuclar });
}
