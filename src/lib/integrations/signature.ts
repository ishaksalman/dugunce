import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * DavetMekanı ↔ DavetPro istek imzalama.
 *
 * Kontrat: docs/DAVETPRO-ENTEGRASYON.md
 * DavetPro deposunda aynı dosyanın eşi var (src/lib/integrations/signature.ts);
 * birini değiştirirken diğerini unutma.
 */

const TOLERANS_SANIYE = 5 * 60;

export function imzaBasliklari(
  gövde: string,
  secret: string,
): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000);
  return {
    "content-type": "application/json",
    "x-dm-timestamp": String(ts),
    "x-dm-signature":
      "sha256=" + createHmac("sha256", secret).update(`${ts}.${gövde}`).digest("hex"),
  };
}

export type DogrulamaSonucu =
  | { ok: true }
  | { ok: false; kod: 401 | 400; mesaj: string };

/** DavetPro'dan gelen callback'leri doğrulamak için. */
export function dogrula(
  gövde: string,
  headers: Headers,
  secret: string | undefined,
): DogrulamaSonucu {
  if (!secret) {
    return { ok: false, kod: 401, mesaj: "Entegrasyon yapılandırılmamış." };
  }

  const ts = Number(headers.get("x-dm-timestamp"));
  const imza = headers.get("x-dm-signature");
  if (!Number.isFinite(ts) || !imza) {
    return { ok: false, kod: 400, mesaj: "İmza başlıkları eksik." };
  }

  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > TOLERANS_SANIYE) {
    return { ok: false, kod: 401, mesaj: "İstek zaman aşımına uğradı." };
  }

  const beklenen =
    "sha256=" + createHmac("sha256", secret).update(`${ts}.${gövde}`).digest("hex");
  const a = Buffer.from(beklenen);
  const b = Buffer.from(imza);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, kod: 401, mesaj: "İmza doğrulanamadı." };
  }
  return { ok: true };
}
