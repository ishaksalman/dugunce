import { cn } from "@/lib/utils";
import type { VenueStatus } from "@/types/db";

/** Durum adları kullanıcıya İngilizce enum olarak gösterilmez. */
const ETIKET: Record<VenueStatus, { label: string; className: string }> = {
  DRAFT: { label: "Taslak", className: "bg-muted text-muted-foreground" },
  PENDING_REVIEW: { label: "İncelemede", className: "bg-warning/15 text-warning-foreground" },
  PUBLISHED: { label: "Yayında", className: "bg-success/15 text-success" },
  REJECTED: { label: "Reddedildi", className: "bg-destructive/10 text-destructive" },
  SUSPENDED: { label: "Askıya alındı", className: "bg-destructive/10 text-destructive" },
};

export function VenueStatusBadge({
  status,
  needsReview,
  className,
}: {
  status: VenueStatus;
  needsReview?: boolean;
  className?: string;
}) {
  const s = ETIKET[status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          "inline-block rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur",
          s.className,
          className,
        )}
      >
        {s.label}
      </span>
      {needsReview && status === "PUBLISHED" ? (
        <span className="inline-block rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-medium text-warning-foreground">
          Değişiklik incelemede
        </span>
      ) : null}
    </span>
  );
}
