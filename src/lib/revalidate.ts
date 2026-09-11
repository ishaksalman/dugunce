import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Bir mekanın VİTRİN sayfasını yeniden üretir.
 *
 * Detay sayfası ISR ile 1 saat önbellekte duruyor (SEO yüzeyimiz olduğu için
 * dinamik yapamıyoruz). On-demand revalidate olmadan iki sorun vardı:
 * sahibi bir alanı düzelttiğinde değişiklik bir saate kadar görünmüyor,
 * daha kötüsü ASKIYA ALINAN mekan o süre boyunca vitrinde kalıyordu.
 *
 * Durum kontrolü yok: taslak/askıda mekanın zaten önbellekte sayfası yok,
 * olmayan yolu tazelemek zararsız. Askıya alma ise tam olarak temizlenmesi
 * gereken durum.
 */
export async function revalidateVenuePage(venueId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venues")
    .select("slug, cities(slug), districts(slug)")
    .eq("id", venueId)
    .single<{
      slug: string;
      cities: { slug: string } | null;
      districts: { slug: string } | null;
    }>();

  if (!data?.cities || !data.districts) return;
  revalidatePath(`/mekanlar/${data.cities.slug}/${data.districts.slug}/${data.slug}`);
}
