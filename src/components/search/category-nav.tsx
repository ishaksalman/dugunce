import Link from "next/link";
import { Camera, Music, PartyPopper, Scissors, Shirt, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessCategory } from "@/types/db";
import type { ComponentType } from "react";

/**
 * "Ne arıyorsun?" — işletme kategorisi seçimi.
 *
 * Etkinlik türünden (düğün, nişan, kına) BİR ÜST katman: kategori işletmenin
 * ne olduğu, etkinlik türü ise mekanın hangi organizasyona uygun olduğu.
 *
 * Liste veritabanından geliyor (`business_categories`). Planlanan kategoriler
 * pasif satır olarak duruyor ve burada "yakında" etiketiyle, TIKLANAMAZ
 * şekilde görünüyor — ölü bağlantı üretmiyoruz. Kategori yayına girdiğinde
 * yapılacak tek şey `is_active = true`.
 */

// İkon kategoriye ait görsel bir tercih; veritabanında ikon kolonu yok ve
// olması da gerekmiyor — kategori sayısı bir elin parmakları kadar.
const IKON: Record<string, ComponentType<{ className?: string }>> = {
  mekan: Sparkles,
  fotografci: Camera,
  gelinlik: Shirt,
  organizasyon: PartyPopper,
  "sac-makyaj": Scissors,
  muzik: Music,
};

export function CategoryNav({ categories }: { categories: BusinessCategory[] }) {
  if (categories.length < 2) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((k) => {
        const Ikon = IKON[k.slug] ?? Sparkles;
        const govde = (
          <>
            <Ikon
              className={cn(
                "size-6",
                k.is_active ? "text-primary" : "text-muted-foreground/60",
              )}
            />
            <span className="mt-2.5 text-sm font-medium">{k.name}</span>
            {!k.is_active ? (
              <span className="mt-0.5 text-xs text-muted-foreground">Yakında</span>
            ) : null}
          </>
        );

        return (
          <li key={k.id}>
            {k.is_active ? (
              <Link
                href={`/${k.path_prefix}`}
                className="flex h-full flex-col items-center rounded-xl border bg-card px-3 py-5 text-center transition-colors hover:border-primary hover:bg-secondary"
              >
                {govde}
              </Link>
            ) : (
              // Bağlantı DEĞİL: gidecek bir sayfa yok. `aria-disabled` ile
              // ekran okuyucuya da aynı şey söyleniyor.
              <div
                aria-disabled="true"
                className="flex h-full cursor-default flex-col items-center rounded-xl border border-dashed bg-muted/30 px-3 py-5 text-center text-muted-foreground"
              >
                {govde}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
