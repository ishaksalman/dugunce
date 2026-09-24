import "server-only";
import { cache } from "react";
import { getDataSource } from "@/lib/db";
import type { BlogPostStatus, ClaimStatus, ImportStatus, InquiryStatus } from "@/types/db";
import type {
  AdminReviewQuery, AdminSeoQuery, AdminUserQuery, AdminVenueQuery,
} from "@/lib/db/source";

/**
 * Yönetim paneli sorguları.
 *
 * Yetki kontrolü veritabanında (`assert_admin()`), sayfa katmanında da
 * `requireRole(["admin"])` var. İkisi de gerekli: sayfa guard'ı kullanıcıyı
 * nazikçe yönlendirir, RPC ise API'yi doğrudan çağıranı durdurur.
 */
export const ADMIN_PAGE_SIZE = 25;

export const getAdminStats = cache(async () => {
  const db = await getDataSource();
  return db.adminStats();
});

export const listAdminVenues = cache(async (input: AdminVenueQuery) => {
  const db = await getDataSource();
  return db.adminListVenues({ ...input, limit: ADMIN_PAGE_SIZE });
});

export const listAdminUsers = cache(async (input: AdminUserQuery) => {
  const db = await getDataSource();
  return db.adminListUsers({ ...input, limit: ADMIN_PAGE_SIZE });
});

export const listAdminReviews = cache(async (input: AdminReviewQuery) => {
  const db = await getDataSource();
  return db.adminListReviews({ ...input, limit: ADMIN_PAGE_SIZE });
});

export const listAdminSeoPages = cache(async (input: AdminSeoQuery) => {
  const db = await getDataSource();
  return db.adminListSeoPages({ ...input, limit: 50 });
});

export const getAdminTaxonomy = cache(async () => {
  const db = await getDataSource();
  return db.adminListTaxonomy();
});

export const listAdminDistricts = cache(async (cityId: string) => {
  const db = await getDataSource();
  return db.adminListDistricts(cityId);
});

export const listAdminClaims = cache(async (status: ClaimStatus | null, offset = 0) => {
  const db = await getDataSource();
  return db.adminListClaims(status, offset);
});

export const listImportItems = cache(
  async (runId: string | null, status: ImportStatus | null, offset = 0) => {
    const db = await getDataSource();
    return db.adminListImportItems(runId, status, offset);
  },
);

export const listAdminBlogPosts = cache(async (status: BlogPostStatus | null, offset = 0) => {
  const db = await getDataSource();
  return db.adminListBlogPosts(status, offset);
});

export const getAdminBlogPost = cache(async (id: string) => {
  const db = await getDataSource();
  return db.adminGetBlogPost(id);
});

export const INQUIRY_PAGE_SIZE = 20;

export const listAdminInquiries = cache(
  async (input: {
    status?: InquiryStatus;
    venueId?: string;
    unclaimedOnly?: boolean;
    query?: string;
    page?: number;
  }) => {
    const db = await getDataSource();
    const page = Math.max(1, input.page ?? 1);
    return db.adminListInquiries({
      status: input.status,
      venueId: input.venueId,
      unclaimedOnly: input.unclaimedOnly,
      query: input.query,
      limit: INQUIRY_PAGE_SIZE,
      offset: (page - 1) * INQUIRY_PAGE_SIZE,
    });
  },
);
