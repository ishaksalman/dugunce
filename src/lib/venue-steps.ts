import type { VenueForEdit } from "@/types/db";
import type { VenueStepSlug } from "@/lib/schemas/venue";

/**
 * Bir adımın "tamamlandı" sayılması için gereken asgari veri.
 *
 * DİKKAT: burası yayına çıkma eşiği DEĞİL — o `venue_completion_of()` ile
 * veritabanında (0002). Burası yalnızca kullanıcıya "bu adımda işin var mı"
 * göstermek için. İkisini karıştırmayın; eşik değişirse SQL tarafı değişir.
 *
 * `"use client"` bir modülde DURAMAZ: hem sunucu sayfası hem istemci
 * gezinmesi kullanıyor.
 */
export function stepCompletion(venue: VenueForEdit): Record<VenueStepSlug, boolean> {
  return {
    "temel-bilgiler": Boolean(venue.name && venue.venue_type_id),
    konum: Boolean(venue.latitude !== null && venue.longitude !== null),
    kapasite: Boolean(venue.min_capacity && venue.max_capacity),
    hizmetler: venue.feature_ids.length >= 3 && venue.event_type_ids.length > 0,
    fiyatlandirma: venue.starting_price !== null,
    fotograflar: venue.images.length >= 5,
    aciklama: (venue.description?.length ?? 0) >= 200,
    onizleme: venue.status !== "DRAFT",
  };
}
