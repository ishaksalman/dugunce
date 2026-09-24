import { SITE } from "@/lib/constants";
import type { BlogPostDetail, VenueDetail, VenueReview } from "@/types/db";

const abs = (path: string) => new URL(path, SITE.url).toString();

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

/**
 * Mekan için `EventVenue`. `aggregateRating` YALNIZCA gerçek onaylı yorum
 * varsa ekleniyor — yorumsuz mekana puan işaretlemek Google'ın yapılandırılmış
 * veri politikasına aykırı ve manuel işlem sebebi.
 */
export function venueJsonLd(
  venue: VenueDetail,
  path: string,
  reviews: VenueReview[] = [],
): Record<string, unknown> {
  const price = venue.starting_price === null ? null : Number(venue.starting_price);
  const ratingCount = Number(venue.rating_count ?? 0);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    "@id": abs(path),
    name: venue.name,
    url: abs(path),
    description: venue.short_description ?? venue.description ?? undefined,
    image: venue.images.slice(0, 6).map((i) => i.url),
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.address ?? undefined,
      addressLocality: venue.district.name,
      addressRegion: venue.city.name,
      addressCountry: "TR",
    },
    telephone: venue.contact_phone ?? undefined,
    sameAs: [venue.website_url, venue.instagram_url].filter(Boolean),
  };

  if (venue.latitude !== null && venue.longitude !== null) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: Number(venue.latitude),
      longitude: Number(venue.longitude),
    };
  }

  if (venue.max_capacity) {
    data.maximumAttendeeCapacity = venue.max_capacity;
  }

  if (price !== null) {
    data.priceRange = `₺${price.toLocaleString("tr-TR")}+`;
  }

  if (ratingCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(venue.rating_avg),
      reviewCount: ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (reviews.length > 0) {
    data.review = reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author_name },
      datePublished: r.created_at,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      name: r.title ?? undefined,
      reviewBody: r.body,
    }));
  }

  return data;
}

export function blogPostingJsonLd(
  post: BlogPostDetail,
  path: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": abs(path),
    mainEntityOfPage: abs(path),
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.cover_image_url ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.published_at ?? undefined,
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
  };
}
