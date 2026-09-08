"use client";

import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocalFavorites } from "@/hooks/use-local-favorites";

/**
 * Giriş yapılmadan da çalışır (localStorage). Üyelik akışı geldiğinde
 * (P5) liste hesaba aktarılacak.
 */
export function FavoriteButton({
  venueId,
  venueName,
  className,
  variant = "overlay",
}: {
  venueId: string;
  venueName: string;
  className?: string;
  variant?: "overlay" | "plain";
}) {
  const { ready, isFavorite, toggle } = useLocalFavorites();
  const active = ready && isFavorite(venueId);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${venueName} favorilerden çıkar` : `${venueName} favorilere ekle`}
      onClick={(e) => {
        // Kart tamamen bir bağlantı; kalbe tıklamak sayfayı değiştirmemeli.
        e.preventDefault();
        e.stopPropagation();
        const added = toggle(venueId);
        toast.success(added ? "Favorilere eklendi" : "Favorilerden çıkarıldı", {
          description: venueName,
        });
      }}
      className={cn(
        "inline-grid place-items-center rounded-full transition-all",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        variant === "overlay"
          ? "size-9 bg-background/85 backdrop-blur hover:bg-background active:scale-95"
          : "size-9 hover:bg-muted",
        className,
      )}
    >
      <Heart
        className={cn(
          "size-[18px] transition-colors",
          active ? "fill-destructive text-destructive" : "text-foreground/70",
        )}
        aria-hidden
      />
    </button>
  );
}
