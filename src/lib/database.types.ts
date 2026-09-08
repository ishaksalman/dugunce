/**
 * Supabase istemcisinin `Database` jeneriği.
 *
 * Normalde `supabase gen types typescript` ile üretilir. Supabase CLI bu
 * makinede kurulu olmadığı için elle yazıldı ve YALNIZCA uygulamanın gerçekten
 * kullandığı tablo/fonksiyonları kapsıyor — tam şemanın kopyası değil.
 *
 * ŞEMA DEĞİŞTİĞİNDE burayı da güncelle. CLI kurulunca bu dosya üretilen
 * çıktıyla değiştirilebilir; isimler o çıktıyla uyumlu seçildi.
 */
import type {
  City, District, EventType, Feature, VenueDetail, VenueReview,
  VenueSearchRow, VenueType,
} from "@/types/db";
import type { CreateInquiryResult } from "@/lib/db/source";

/**
 * `interface` tipleri TypeScript'te örtük index signature taşımaz ve
 * supabase-js'in `Record<string, unknown>` kısıtını geçemez; istemci sessizce
 * boş şemaya düşer ve tüm RPC argümanları `undefined` olur. Mapped type
 * anonim bir nesne tipi üretir ve kısıtı geçer.
 */
type Simplify<T> = { [K in keyof T]: T[K] };

type ReadOnly<T> = {
  Row: Simplify<T>;
  Insert: never;
  Update: never;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      cities: ReadOnly<City & { sort_order: number; is_popular: boolean }>;
      districts: ReadOnly<District>;
      event_types: ReadOnly<EventType & { is_active: boolean }>;
      venue_types: ReadOnly<VenueType & { is_active: boolean }>;
      features: ReadOnly<Feature & { is_active: boolean }>;
    };
    Views: Record<string, never>;
    Functions: {
      search_venues: {
        Args: {
          p_city_slug?: string | null;
          p_district_slug?: string | null;
          p_event_type_slug?: string | null;
          p_venue_type_slug?: string | null;
          p_guest_count?: number | null;
          p_min_capacity?: number | null;
          p_max_capacity?: number | null;
          p_min_price?: number | null;
          p_max_price?: number | null;
          p_has_indoor?: boolean | null;
          p_has_outdoor?: boolean | null;
          p_feature_slugs?: string[] | null;
          p_query?: string | null;
          p_sort?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: VenueSearchRow[];
      };
      get_venue_detail: {
        Args: { p_slug: string };
        Returns: VenueDetail | null;
      };
      get_venue_reviews: {
        Args: { p_venue_id: string; p_limit?: number; p_offset?: number };
        Returns: VenueReview[];
      };
      record_venue_view: {
        Args: { p_venue_id: string };
        Returns: undefined;
      };
      create_inquiry: {
        Args: {
          p_venue_id: string;
          p_full_name: string;
          p_phone: string;
          p_email?: string | null;
          p_event_type_id?: string | null;
          p_event_date?: string | null;
          p_guest_count?: number | null;
          p_message?: string | null;
          p_ip_hash?: string | null;
          p_ua_hash?: string | null;
          p_max_per_hour?: number;
          p_max_per_venue_per_day?: number;
        };
        Returns: CreateInquiryResult;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
