"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshSeoPages } from "@/lib/actions/admin";

/**
 * Yeni mekan eklendikçe yeni kombinasyonlar oluşuyor. Bu düğme onları
 * üretir ve eşiği geçenleri indekslemeye açar. Elle düzenlenmiş metinleri
 * EZMEZ.
 */
export function SeoRefreshButton({ esik }: { esik: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      className="h-10 gap-2"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await refreshSeoPages(esik);
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
          toast.success("Sayfalar güncellendi", { description: r.data.ozet });
          router.refresh();
        })
      }
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden />
      {pending ? "Üretiliyor…" : "Sayfaları yeniden üret"}
    </Button>
  );
}
