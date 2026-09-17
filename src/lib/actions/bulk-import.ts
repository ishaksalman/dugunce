"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { jsonMu, parseBulkInput, parsePlacesJson } from "@/lib/import/parse";
import { resolveMapsUrls } from "@/lib/import/resolve";
import { actionError, actionOk, unexpectedError, type ActionResult } from "@/lib/errors";
import {
  TOPLU_LIMIT, type BulkCommitResult, type BulkPreviewRow,
} from "@/lib/import/types";

const previewSchema = z.object({
  metin: z.string().min(1, "Yapıştırılacak bir şey yok.").max(20000),
  cityId: z.string().uuid("Şehir seçin."),
});

/**
 * Yapıştırılan metni kayda çevrilebilir satırlara ayırır ve HER SATIR İÇİN
 * katalogda benzer kayıt olup olmadığına bakar. Hiçbir şey yazmaz.
 *
 * Önizleme adımı isteğe bağlı değil: kötü bir yapıştırma 50 çöp kayıt
 * açabilir ve bunları tek tek silmek, açmaktan uzun sürer.
 */
export async function previewBulkVenues(
  input: unknown,
): Promise<ActionResult<{ rows: BulkPreviewRow[]; fazlalik: number }>> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Geçersiz istek.");
  }

  try {
    await requireRole(["admin"]);
    const db = await getDataSource();

    // Girdi ya serbest satır listesi ya da Google Places dökümü (JSON dizisi).
    const json = jsonMu(parsed.data.metin);
    const cozum = json
      ? parsePlacesJson(parsed.data.metin, TOPLU_LIMIT)
      : { ...parseBulkInput(parsed.data.metin, TOPLU_LIMIT), hata: null };
    if (cozum.hata) return actionError(cozum.hata);
    const { rows, fazlalik } = cozum;

    // Yalnızca EKSİĞİ olan satırlar için ağa çıkıyoruz. JSON girdide ad ve
    // koordinat zaten dolu; her satır için yönlendirme takip etmek hem
    // gereksiz hem de arama adreslerinde hata üretiyordu.
    const cozulen = await resolveMapsUrls(
      rows
        .filter((r) => !r.name || r.latitude === null)
        .map((r) => r.mapsUrl)
        .filter((u): u is string => u !== null),
    );

    const sonuc: BulkPreviewRow[] = [];
    for (const r of rows) {
      const c = r.mapsUrl ? cozulen.get(r.mapsUrl) : undefined;
      const name = r.name ?? c?.name ?? null;

      const benzer =
        name || r.phone || r.placeId
          ? await db.adminFindSimilarVenues(
              name ?? "",
              parsed.data.cityId,
              r.phone,
              r.placeId,
            )
          : [];

      sonuc.push({
        satirNo: r.satirNo,
        ham: r.ham,
        name,
        phone: r.phone,
        mapsUrl: c?.finalUrl ?? r.mapsUrl,
        latitude: r.latitude ?? c?.latitude ?? null,
        longitude: r.longitude ?? c?.longitude ?? null,
        address: r.address,
        website: r.website,
        placeId: r.placeId,
        kategori: r.kategori,
        benzer,
        hata: r.hata ?? c?.hata ?? (name ? null : "Ad okunamadı, elle yazın."),
      });
    }

    return actionOk({ rows: sonuc, fazlalik });
  } catch (error) {
    return unexpectedError("previewBulkVenues", error);
  }
}

const commitSchema = z.object({
  cityId: z.string().uuid(),
  districtId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(20).optional().transform((v) => (v ? v : null)),
        mapsUrl: z.string().trim().max(600).optional().transform((v) => (v ? v : null)),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        address: z.string().trim().max(300).nullable().optional(),
        website: z.string().trim().max(300).nullable().optional(),
        placeId: z.string().trim().max(120).nullable().optional(),
        force: z.boolean().optional(),
      }),
    )
    .min(1, "Eklenecek satır seçilmedi.")
    .max(TOPLU_LIMIT),
});

/**
 * Seçili satırları katalog kaydı olarak açar.
 *
 * Her satır tek tek `admin_create_venue` üzerinden gidiyor — mükerrer
 * kontrolü ve denetim izi orada. Toplu iş diye o kapıyı atlamak, tam da
 * korunmak istediğimiz hatayı 50 katına çıkarırdı.
 *
 * Bir satırın hatası diğerlerini DÜŞÜRMÜYOR: sebebiyle birlikte raporlanıyor.
 */
export async function commitBulkVenues(
  input: unknown,
): Promise<ActionResult<BulkCommitResult>> {
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Geçersiz istek.");
  }

  try {
    await requireRole(["admin"]);
    const db = await getDataSource();

    let eklenen = 0;
    const atlanan: { name: string; sebep: string }[] = [];

    for (const satir of parsed.data.rows) {
      try {
        // Konum ve Google alanları artık admin_create_venue içinde: tek
        // işlemde yazılıyor ve place_id mükerrer kontrolü orada çalışıyor.
        await db.adminCreateVenue({
          name: satir.name,
          cityId: parsed.data.cityId,
          districtId: parsed.data.districtId,
          categoryId: null,
          venueTypeId: null,
          address: satir.address ?? null,
          contactPhone: satir.phone,
          websiteUrl: satir.website ?? null,
          force: satir.force ?? false,
          googlePlaceId: satir.placeId ?? null,
          googleMapsUrl: satir.mapsUrl,
          latitude: satir.latitude ?? null,
          longitude: satir.longitude ?? null,
        });

        eklenen += 1;
      } catch (e) {
        atlanan.push({
          name: satir.name,
          sebep: e instanceof Error ? temizHata(e.message) : "Bilinmeyen hata",
        });
      }
    }

    revalidatePath("/yonetim/mekanlar");
    return actionOk({ eklenen, atlanan });
  } catch (error) {
    return unexpectedError("commitBulkVenues", error);
  }
}

function temizHata(message: string): string {
  if (message.includes("aynı adlı bir kayıt zaten var")) {
    return "Bu ilçede aynı adlı kayıt var";
  }
  if (message.includes("telefon numarası başka bir kayıtta")) {
    return "Bu telefon başka kayıtta";
  }
  if (message.includes("Google kaydı zaten katalogda")) {
    return "Bu Google kaydı zaten katalogda";
  }
  if (message.includes("ilçe bu şehre ait değil")) return "İlçe şehre ait değil";
  return "Kaydedilemedi";
}
