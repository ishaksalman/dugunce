import "server-only";
import { imzaBasliklari } from "./signature";

/**
 * DavetPro'ya giden HTTP istemcisi.
 *
 * Kontrat: docs/DAVETPRO-ENTEGRASYON.md
 *
 * İlke: bu modüldeki hiçbir çağrı kullanıcı akışını bloklamaz. Talep her
 * koşulda DavetMekanı'na kaydedilir; aktarım kuyruktan yürür.
 */

export interface DavetProLead {
  external_id: string;
  davetpro_venue_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  event_type_slug: string | null;
  event_date: string | null;
  guest_count: number | null;
  message: string | null;
  created_at: string;
}

export interface LeadPushResult {
  external_id: string;
  lead_id: string | null;
  created: boolean;
}

export class DavetProError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DavetProError";
  }
}

function yapilandirma() {
  const url = process.env.DAVETPRO_URL;
  const secret = process.env.DAVETPRO_INTEGRATION_SECRET;
  if (!url || !secret) {
    throw new DavetProError(
      "DAVETPRO_URL veya DAVETPRO_INTEGRATION_SECRET tanımlı değil.",
    );
  }
  return { url: url.replace(/\/+$/, ""), secret };
}

export function davetProYapilandirildiMi(): boolean {
  return Boolean(process.env.DAVETPRO_URL && process.env.DAVETPRO_INTEGRATION_SECRET);
}

async function gonder<T>(yol: string, gövde: unknown, timeoutMs = 15_000): Promise<T> {
  const { url, secret } = yapilandirma();
  const metin = JSON.stringify(gövde);

  // Zaman aşımı olmadan takılı bir istek kuyruk işleyicisini kilitler.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}${yol}`, {
      method: "POST",
      headers: imzaBasliklari(metin, secret),
      body: metin,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new DavetProError(`Geçersiz yanıt (${res.status}).`, res.status);
    }

    // 207 = kısmi başarı; gövdedeki sonuçlara bakılır, hata sayılmaz.
    if (!res.ok && res.status !== 207) {
      const mesaj =
        (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
      throw new DavetProError(mesaj, res.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof DavetProError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new DavetProError("DavetPro yanıt vermedi (zaman aşımı).");
    }
    throw new DavetProError((error as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Talepleri DavetPro'ya aktarır.
 * Canlı gönderim ve geçmiş toplu aktarım AYNI yolu kullanır — iki ayrı
 * kod yolu yazılırsa biri bozulur.
 */
export async function pushLeads(
  businessId: string,
  leads: DavetProLead[],
): Promise<LeadPushResult[]> {
  if (leads.length === 0) return [];
  const yanit = await gonder<{ ok: boolean; results: LeadPushResult[] }>(
    "/api/integrations/davetmekani/leads",
    { v: 1, business_id: businessId, leads },
  );
  return yanit.results ?? [];
}

export interface LinkVerification {
  ok: true;
  business_id: string;
  business_name: string;
  venue_id: string | null;
  venue_name: string | null;
}

/** Kullanıcının girdiği bağlama kodunu DavetPro'da doğrular. */
export async function verifyLinkCode(code: string): Promise<LinkVerification> {
  return gonder<LinkVerification>("/api/integrations/davetmekani/verify-link", {
    v: 1,
    code: code.trim().toUpperCase(),
  });
}
