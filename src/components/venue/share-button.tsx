"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Mobilde işletim sisteminin paylaşım sayfasını açar; desteklenmiyorsa
 * bağlantıyı panoya kopyalar.
 */
export function ShareButton({ title }: { title: string }) {
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Kullanıcı paylaşım sayfasını kapattıysa hata değil, sessizce geç.
        if ((error as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Bağlantı kopyalandı");
    } catch {
      toast.error("Bağlantı kopyalanamadı");
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Share2 className="size-4" aria-hidden />
      Paylaş
    </button>
  );
}
