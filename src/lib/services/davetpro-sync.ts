import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DavetProError, pushLeads, davetProYapilandirildiMi,
  type DavetProLead,
} from "@/lib/integrations/davetpro";

/**
 * Aktarım kuyruğu işleyicisi.
 *
 * Kuyruk tablosuna yalnızca service_role yazabiliyor; bu yüzden admin
 * istemcisi kullanılıyor. Çağıranın yetkisi ÇAĞIRMADAN ÖNCE doğrulanmalı
 * (uç noktada cron gizli anahtarı ile).
 */

interface ClaimedJob {
  job_id: string;
  inquiry_id: string;
  business_id: string;
  davetpro_venue_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  event_type_slug: string | null;
  event_date: string | null;
  guest_count: number | null;
  message: string | null;
  inquiry_created_at: string;
}

export interface SyncRunResult {
  claimed: number;
  sent: number;
  failed: number;
  skipped?: string;
}

export async function processSyncQueue(limit = 50): Promise<SyncRunResult> {
  if (!davetProYapilandirildiMi()) {
    return { claimed: 0, sent: 0, failed: 0, skipped: "DavetPro yapılandırılmamış" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_davetpro_sync_jobs", {
    p_limit: limit,
  });
  if (error) throw new Error(`claim_davetpro_sync_jobs: ${error.message}`);

  const jobs = (data ?? []) as unknown as ClaimedJob[];
  if (jobs.length === 0) return { claimed: 0, sent: 0, failed: 0 };

  // DavetPro tarafı tek istekte tek işletme kabul ediyor; işleri işletmeye
  // göre grupluyoruz.
  const gruplar = new Map<string, ClaimedJob[]>();
  for (const job of jobs) {
    const liste = gruplar.get(job.business_id) ?? [];
    liste.push(job);
    gruplar.set(job.business_id, liste);
  }

  let sent = 0;
  let failed = 0;

  for (const [businessId, grup] of gruplar) {
    const leads: DavetProLead[] = grup.map((j) => ({
      external_id: j.inquiry_id,
      davetpro_venue_id: j.davetpro_venue_id,
      full_name: j.full_name,
      phone: j.phone,
      email: j.email,
      event_type_slug: j.event_type_slug,
      event_date: j.event_date,
      guest_count: j.guest_count,
      message: j.message,
      created_at: j.inquiry_created_at,
    }));

    try {
      const results = await pushLeads(businessId, leads);
      const byExternal = new Map(results.map((r) => [r.external_id, r]));

      for (const job of grup) {
        const r = byExternal.get(job.inquiry_id);
        // `created: false` HATA DEĞİLDİR — idempotency çalışmış demektir.
        const basarili = Boolean(r?.lead_id);
        await supabase.rpc("complete_davetpro_sync_job", {
          p_job_id: job.job_id,
          p_ok: basarili,
          p_lead_id: r?.lead_id ?? null,
          p_error: basarili ? null : "DavetPro lead oluşturmadı",
        });
        if (basarili) sent++;
        else failed++;
      }
    } catch (error) {
      // Tüm grup başarısız; her iş kendi geri çekilme sayacıyla tekrar denenir.
      const mesaj =
        error instanceof DavetProError ? error.message : (error as Error).message;
      for (const job of grup) {
        await supabase.rpc("complete_davetpro_sync_job", {
          p_job_id: job.job_id,
          p_ok: false,
          p_lead_id: null,
          p_error: mesaj,
        });
        failed++;
      }
    }
  }

  return { claimed: jobs.length, sent, failed };
}
