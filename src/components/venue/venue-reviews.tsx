import { Star } from "lucide-react";
import { formatDate, formatRating } from "@/lib/format";
import type { VenueReview } from "@/types/db";

export function VenueReviews({
  reviews,
  total,
  ratingAvg,
  ratingCount,
}: {
  reviews: VenueReview[];
  total: number;
  ratingAvg: number;
  ratingCount: number;
}) {
  if (ratingCount === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Bu mekan için henüz yorum yapılmamış.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Stars value={ratingAvg} />
        <span className="tabular text-lg font-medium">{formatRating(ratingAvg)}</span>
        <span className="text-sm text-muted-foreground">
          {ratingCount} değerlendirme
        </span>
      </div>

      <ul className="divide-y">
        {reviews.map((r) => (
          <li key={r.id} className="py-5 first:pt-0">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">{r.author_name}</p>
              <time
                dateTime={r.created_at}
                className="tabular shrink-0 text-xs text-muted-foreground"
              >
                {formatDate(r.created_at)}
              </time>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Stars value={r.rating} size="sm" />
              {r.title ? <p className="text-sm font-medium">{r.title}</p> : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
          </li>
        ))}
      </ul>

      {total > reviews.length ? (
        <p className="text-sm text-muted-foreground">
          {reviews.length} / {total} değerlendirme gösteriliyor.
        </p>
      ) : null}
    </div>
  );
}

function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "size-3.5" : "size-4";
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`5 üzerinden ${formatRating(value)}`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${
            i <= Math.round(value)
              ? "fill-foreground text-foreground"
              : "text-muted-foreground/35"
          }`}
          aria-hidden
        />
      ))}
    </span>
  );
}
