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
  AdminReview, AdminUser, AdminVenue, City, District, EventType, Feature,
  InquiryStatus, OwnerInquiry, ReviewStatus, UserRole, VenueDetail, VenueReview,
  VenueSearchRow, VenueStatus, VenueType,
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
      profiles: {
        Row: Simplify<{
          id: string;
          full_name: string;
          phone: string | null;
          role: UserRole;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Insert: never;
        Update: Simplify<{ full_name?: string; phone?: string | null; avatar_url?: string | null }>;
        Relationships: [];
      };
      venues: {
        Row: Simplify<{ id: string; owner_id: string; slug: string; name: string }>;
        Insert: Simplify<{
          owner_id: string;
          slug: string;
          name: string;
          city_id: string;
          district_id: string;
        }>;
        Update: Simplify<Record<string, unknown>>;
        Relationships: [];
      };
      venue_images: {
        Row: Simplify<{
          id: string;
          venue_id: string;
          storage_path: string;
          url: string;
          alt_text: string | null;
          sort_order: number;
          is_cover: boolean;
        }>;
        Insert: Simplify<{
          venue_id: string;
          storage_path: string;
          url: string;
          width?: number | null;
          height?: number | null;
          alt_text?: string | null;
          sort_order?: number;
          is_cover?: boolean;
        }>;
        Update: Simplify<{ is_cover?: boolean; alt_text?: string | null; sort_order?: number }>;
        Relationships: [];
      };
      inquiries: {
        Row: Simplify<{ id: string; status: InquiryStatus; owner_note: string | null }>;
        Insert: never;
        Update: Simplify<{ status?: InquiryStatus; owner_note?: string | null }>;
        Relationships: [];
      };
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
      become_venue_owner: {
        Args: Record<string, never>;
        Returns: "customer" | "venue_owner" | "admin";
      };
      get_owner_stats: {
        Args: { p_venue_id: string };
        Returns: Record<string, unknown> | null;
      };
      get_my_venues: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>[];
      };
      purge_expired_data: {
        Args: Record<string, never>;
        Returns: Record<string, number>;
      };
      admin_stats: { Args: Record<string, never>; Returns: Record<string, number> };
      admin_list_venues: {
        Args: {
          p_status?: VenueStatus | null;
          p_query?: string | null;
          p_needs_review?: boolean | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: AdminVenue[];
      };
      admin_set_venue_status: {
        Args: { p_venue_id: string; p_status: VenueStatus; p_reason?: string | null };
        Returns: { ok: boolean };
      };
      admin_set_venue_featured: {
        Args: { p_venue_id: string; p_featured: boolean; p_until?: string | null };
        Returns: { ok: boolean };
      };
      admin_list_users: {
        Args: {
          p_role?: UserRole | null;
          p_query?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: AdminUser[];
      };
      admin_set_user_role: {
        Args: { p_user_id: string; p_role: UserRole };
        Returns: { ok: boolean };
      };
      admin_set_user_active: {
        Args: { p_user_id: string; p_active: boolean; p_reason?: string | null };
        Returns: { ok: boolean };
      };
      admin_list_reviews: {
        Args: { p_status?: ReviewStatus | null; p_limit?: number; p_offset?: number };
        Returns: AdminReview[];
      };
      admin_moderate_review: {
        Args: { p_review_id: string; p_status: ReviewStatus; p_note?: string | null };
        Returns: { ok: boolean };
      };
      list_venue_sitemap: {
        Args: Record<string, never>;
        Returns: { path: string; updated_at: string }[];
      };
      admin_list_seo_pages: {
        Args: {
          p_kind?: string | null;
          p_active?: boolean | null;
          p_query?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Record<string, unknown>[];
      };
      admin_update_seo_page: {
        Args: {
          p_id: string;
          p_title?: string | null;
          p_meta_description?: string | null;
          p_h1?: string | null;
          p_intro_html?: string | null;
          p_min_venue_count?: number | null;
          p_is_active?: boolean | null;
        };
        Returns: { ok: boolean };
      };
      admin_refresh_seo_pages: {
        Args: { p_min_venues?: number };
        Returns: Record<string, unknown>;
      };
      admin_list_taxonomy: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      admin_list_districts: {
        Args: { p_city_id: string };
        Returns: Record<string, unknown>;
      };
      admin_upsert_event_type: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_seo_noun: string;
          p_icon?: string | null;
          p_sort_order?: number;
          p_is_active?: boolean;
        };
        Returns: Record<string, unknown>;
      };
      admin_upsert_venue_type: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_sort_order?: number;
          p_is_active?: boolean;
        };
        Returns: Record<string, unknown>;
      };
      admin_upsert_feature: {
        Args: {
          p_id: string | null;
          p_kind: "ozellik" | "hizmet";
          p_group_name: string;
          p_name: string;
          p_icon?: string | null;
          p_is_filter?: boolean;
          p_sort_order?: number;
          p_is_active?: boolean;
        };
        Returns: Record<string, unknown>;
      };
      admin_set_city_popular: {
        Args: { p_city_id: string; p_popular: boolean };
        Returns: Record<string, unknown>;
      };
      admin_upsert_district: {
        Args: { p_id: string | null; p_city_id: string; p_name: string };
        Returns: Record<string, unknown>;
      };
      get_seo_page: {
        Args: { p_path: string };
        Returns: Record<string, unknown> | null;
      };
      list_active_seo_pages: {
        Args: Record<string, never>;
        Returns: { path: string; updated_at: string; kind: string }[];
      };
      refresh_seo_pages: {
        Args: { p_min_venues?: number };
        Returns: Record<string, number | boolean>;
      };
      get_venues_by_ids: {
        Args: { p_ids: string[] };
        Returns: VenueSearchRow[];
      };
      get_davetpro_status: {
        Args: { p_venue_id: string };
        Returns: Record<string, unknown> | null;
      };
      get_venue_for_edit: {
        Args: { p_venue_id: string };
        Returns: Record<string, unknown> | null;
      };
      set_venue_features: {
        Args: { p_venue_id: string; p_feature_ids: string[] };
        Returns: undefined;
      };
      set_venue_event_types: {
        Args: { p_venue_id: string; p_event_type_ids: string[] };
        Returns: undefined;
      };
      reorder_venue_images: {
        Args: { p_venue_id: string; p_image_ids: string[] };
        Returns: undefined;
      };
      suggest_venue_slug: {
        Args: { p_name: string; p_venue_id?: string | null };
        Returns: string;
      };
      link_venue_to_davetpro: {
        Args: {
          p_venue_id: string;
          p_business_id: string;
          p_davetpro_venue_id?: string | null;
        };
        Returns: { ok: boolean; venue_id: string; queued_inquiries: number };
      };
      unlink_venue_from_davetpro: {
        Args: { p_venue_id: string };
        Returns: { ok: boolean };
      };
      claim_davetpro_sync_jobs: {
        Args: { p_limit?: number };
        Returns: Record<string, unknown>[];
      };
      complete_davetpro_sync_job: {
        Args: {
          p_job_id: string;
          p_ok: boolean;
          p_lead_id?: string | null;
          p_error?: string | null;
        };
        Returns: undefined;
      };
      get_owner_inquiries: {
        Args: {
          p_status?: InquiryStatus | null;
          p_venue_id?: string | null;
          p_query?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: OwnerInquiry[];
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
