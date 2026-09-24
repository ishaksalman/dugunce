"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { ingestVenueImages } from "@/lib/import/images";
import { revalidateVenuePage } from "@/lib/revalidate";
import { actionError, actionOk, unexpectedError, type ActionResult } from "@/lib/errors";
import type { ImportStatus } from "@/types/db";

/**
 * İçe aktarma boru hattı — KAYNAKTAN BAĞIMSIZ.
 *
 * Bir işletmenin bilgilerini ve görsel adreslerini alır; kaydı açar,
 * görselleri mevcut medya sistemine indirir, sonucu günlüğe yazar.
 *
 * Kaynağın meşruluğuna bu katman karar VERMİYOR — çağıran veriyi nereden
 * aldığını bilir. Meşru kaynaklar: işletmenin kendi verdiği galeri,
 * tamamlama bağlantısından yüklenenler, izni alınmış site/hesap.
 *
 * Üç tasarım kararı:
 *
 * 1. Görsel hatası kaydı DÜŞÜRMEZ. 8 görselin 2'si inse bile mekan açılır,
 *    durum `partial` olur. Elde olan veriyi de atmak kötü bir takas.
 * 2. Her kayıt `admin_create_venue`'den geçer — mükerrer kontrolü ve
 *    denetim izi orada. Boru hattı o kapıyı atlamıyor.
 * 3. `source_url` tekil: iş yarıda kalırsa aynı sayfa ikinci kez
 *    işlenemiyor. Devam etmek için `checkImportProcessed` var.
 * 4. Kayıt açılıp TÜM görseller sorunsuz indiyse admin onayı beklemeden
 *    otomatik `PUBLISHED` olur — tek tek "yayınla" tıklamak onlarca satırlık
 *    bir toplu içe aktarmada darboğaz. Görselsiz (`imageUrls` boş), kısmi
 *    ya da hiç inmemiş kayıtlar `DRAFT`'ta kalır; bunlar admin'in elle
 *    bakması gereken satırlar, otomatik yayına girmez (bkz. `importOneVenue`
 *    sonundaki yayınlama bloğu). Yayınlama best-effort: başarısız olursa
 *    içe aktarmanın kendisini düşürmez, kayıt `DRAFT` kalır ve admin panelden
 *    elle yayınlanabilir.
 */

const baslatSchema = z.object({
  source: z.string().trim().min(2).max(60),
  note: z.string().trim().max(300).optional(),
});

export async function startImportRun(
  input: unknown,
): Promise<ActionResult<{ runId: string }>> {
  const parsed = baslatSchema.safeParse(input);
  if (!parsed.success) return actionError("Geçersiz istek.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    const runId = await db.adminStartImportRun(parsed.data.source, parsed.data.note);
    return actionOk({ runId });
  } catch (error) {
    return unexpectedError("startImportRun", error);
  }
}

export async function finishImportRun(runId: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(runId);
  if (!parsed.success) return actionError("Geçersiz iş.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminFinishImportRun(parsed.data);
    revalidatePath("/yonetim/ice-aktarma");
    return actionOk();
  } catch (error) {
    return unexpectedError("finishImportRun", error);
  }
}

/** Devam etme: bu kaynak adresleri daha önce işlendi mi? */
export async function checkImportProcessed(
  sourceUrls: unknown,
): Promise<ActionResult<{ islenmis: string[] }>> {
  const parsed = z.array(z.string().trim().min(1).max(600)).max(200).safeParse(sourceUrls);
  if (!parsed.success) return actionError("Geçersiz adres listesi.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    const harita = await db.adminImportProcessed(parsed.data);
    return actionOk({
      islenmis: [...harita.entries()].filter(([, v]) => v).map(([k]) => k),
    });
  } catch (error) {
    return unexpectedError("checkImportProcessed", error);
  }
}

const aktarSchema = z.object({
  runId: z.string().uuid(),
  source: z.string().trim().min(2).max(60),
  sourceUrl: z.string().trim().max(600).optional().transform((v) => (v ? v : null)),
  name: z.string().trim().min(2).max(120),
  cityId: z.string().uuid(),
  districtId: z.string().uuid(),
  venueTypeId: z.string().uuid().nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  website: z.string().trim().max(300).nullable().optional(),
  instagram: z.string().trim().max(300).nullable().optional(),
  placeId: z.string().trim().max(120).nullable().optional(),
  mapsUrl: z.string().trim().max(600).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  imageUrls: z.array(z.string().url().max(1000)).max(40).default([]),
  force: z.boolean().optional(),
  // Yapılandırılmış olgular — description'a YAZILMAZ (bkz. migration 0040).
  minCapacity: z.number().int().min(0).max(100000).nullable().optional(),
  maxCapacity: z.number().int().min(0).max(100000).nullable().optional(),
  startingPrice: z.number().min(0).max(100000000).nullable().optional(),
  priceMax: z.number().min(0).max(100000000).nullable().optional(),
  priceType: z.enum(["kisi_basi", "paket", "gunluk", "belirtilmemis"]).nullable().optional(),
  priceNote: z.string().trim().max(500).nullable().optional(),
  hasIndoor: z.boolean().nullable().optional(),
  hasOutdoor: z.boolean().nullable().optional(),
  featureSlugs: z.array(z.string().trim().max(60)).max(40).default([]),
  eventTypeSlugs: z.array(z.string().trim().max(60)).max(10).default([]),
});

export interface ImportOneResult {
  status: ImportStatus;
  venueId: string | null;
  imageTotal: number;
  imageOk: number;
  imageFailed: number;
  /** Düşen görsellerin sebepleri — arayüzde satır satır gösteriliyor. */
  imageErrors: { url: string; hata: string }[];
  error: string | null;
}

export async function importOneVenue(
  input: unknown,
): Promise<ActionResult<ImportOneResult>> {
  const parsed = aktarSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Geçersiz istek.");
  }
  const d = parsed.data;

  try {
    await requireRole(["admin"]);
    const db = await getDataSource();

    // --- Kaydı aç -----------------------------------------------------------
    let venueId: string;
    try {
      const sonuc = await db.adminCreateVenue({
        name: d.name,
        cityId: d.cityId,
        districtId: d.districtId,
        categoryId: null,
        venueTypeId: d.venueTypeId ?? null,
        address: d.address ?? null,
        contactPhone: d.phone ?? null,
        websiteUrl: d.website ?? null,
        instagramUrl: d.instagram ?? null,
        force: d.force ?? false,
        googlePlaceId: d.placeId ?? null,
        googleMapsUrl: d.mapsUrl ?? null,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        source: d.source,
        sourceUrl: d.sourceUrl,
        minCapacity: d.minCapacity ?? null,
        maxCapacity: d.maxCapacity ?? null,
        startingPrice: d.startingPrice ?? null,
        priceMax: d.priceMax ?? null,
        priceType: d.priceType ?? null,
        priceNote: d.priceNote ?? null,
        hasIndoor: d.hasIndoor ?? null,
        hasOutdoor: d.hasOutdoor ?? null,
        featureSlugs: d.featureSlugs,
        eventTypeSlugs: d.eventTypeSlugs,
      });
      venueId = sonuc.id;

      // Yeni satır açılmadı — mükerrer bir kayıt vardı ve yeni bir etkinlik
      // türü taşıyordu, mevcut kayda eklendi (0048). Görselleri TEKRAR
      // indirmiyoruz: o mekan zaten galerisiyle birlikte içeride.
      if (sonuc.merged) {
        const not = "Zaten katalogda — eksik olan etkinlik türü mevcut kayda eklendi.";
        await db.adminLogImportItem({
          runId: d.runId, status: "duplicate", sourceUrl: d.sourceUrl,
          name: d.name, venueId, error: not,
        });
        return actionOk({
          status: "duplicate", venueId,
          imageTotal: 0, imageOk: 0, imageFailed: 0,
          imageErrors: [], error: not,
        });
      }
    } catch (e) {
      const mesaj = e instanceof Error ? e.message : "Bilinmeyen hata";
      // Mükerrer bir başarısızlık değil, bilgi: kayıt zaten var.
      const mukerrer =
        mesaj.includes("zaten") || mesaj.includes("başka bir kayıtta");
      const durum: ImportStatus = mukerrer ? "duplicate" : "failed";

      await db.adminLogImportItem({
        runId: d.runId, status: durum, sourceUrl: d.sourceUrl,
        name: d.name, error: mesaj,
      });
      return actionOk({
        status: durum, venueId: null,
        imageTotal: d.imageUrls.length, imageOk: 0, imageFailed: 0,
        imageErrors: [], error: mesaj,
      });
    }

    // --- Görseller ----------------------------------------------------------
    const ozet = d.imageUrls.length > 0
      ? await ingestVenueImages(venueId, d.imageUrls)
      : { toplam: 0, basarili: 0, basarisiz: 0, sonuclar: [], kapakAyarlandi: false };

    // Görsel istendi ama hiçbiri inmediyse elle bakılmalı.
    const durum: ImportStatus =
      ozet.toplam === 0 ? "imported"
        : ozet.basarili === 0 ? "needs_review"
          : ozet.basarisiz > 0 ? "partial"
            : "imported";

    await db.adminLogImportItem({
      runId: d.runId,
      status: durum,
      sourceUrl: d.sourceUrl,
      name: d.name,
      venueId,
      imageTotal: ozet.toplam,
      imageOk: ozet.basarili,
      imageFailed: ozet.basarisiz,
      error: ozet.basarisiz > 0
        ? ozet.sonuclar.filter((s) => !s.ok).map((s) => s.hata).join(" · ").slice(0, 900)
        : null,
    });

    // Kaydın kendisi ve TÜM görselleri sorunsuz indiyse elle onay beklemeye
    // gerek yok — direkt yayına al. Kısmi/incelemesi-gereken/görselsiz
    // kayıtlar DRAFT'ta kalıp admin'in önüne düşmeye devam ediyor (bkz.
    // CLAUDE.md: toplu girişte yanlış kayıt riski gerçek).
    if (durum === "imported" && ozet.toplam > 0) {
      try {
        await db.adminSetVenueStatus(venueId, "PUBLISHED");
        await revalidateVenuePage(venueId);
      } catch (e) {
        console.error("[importOneVenue] otomatik yayına alma başarısız", e);
      }
    }

    revalidatePath("/yonetim/mekanlar");
    revalidatePath("/yonetim/ice-aktarma");

    return actionOk({
      status: durum,
      venueId,
      imageTotal: ozet.toplam,
      imageOk: ozet.basarili,
      imageFailed: ozet.basarisiz,
      imageErrors: ozet.sonuclar
        .filter((s) => !s.ok)
        .map((s) => ({ url: s.url, hata: s.hata ?? "Bilinmeyen" })),
      error: null,
    });
  } catch (error) {
    return unexpectedError("importOneVenue", error);
  }
}
