"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  attachVenueImage, deleteVenueImage, setVenueCoverImage,
} from "@/lib/actions/venue-images";
import { cn } from "@/lib/utils";
import type { VenueForEdit } from "@/types/db";
import { useRouter } from "next/navigation";

const BUCKET = "venue-images";
const MAX_BYTE = 8 * 1024 * 1024;
const KABUL = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ONERILEN_ADET = 5;

/**
 * Fotoğraf yönetimi.
 *
 * Dosya tarayıcıdan DOĞRUDAN Supabase Storage'a gidiyor; sunucu üzerinden
 * geçirmek her fotoğrafı iki kez ağdan taşır ve server action gövde
 * limitine takılır. Storage politikası (0007) kullanıcının yalnızca kendi
 * mekanının klasörüne yazmasına izin veriyor.
 */
export function PhotosStep({ venue }: { venue: VenueForEdit }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [ilerleme, setIlerleme] = useState({ tamam: 0, toplam: 0 });
  const [pending, startTransition] = useTransition();

  const yukle = async (files: FileList) => {
    const secilen = [...files];
    const gecerli = secilen.filter((f) => {
      if (!KABUL.includes(f.type)) {
        toast.error(`${f.name}: yalnızca JPG, PNG, WEBP ve AVIF yüklenebilir.`);
        return false;
      }
      if (f.size > MAX_BYTE) {
        toast.error(`${f.name}: dosya 8 MB'tan büyük.`);
        return false;
      }
      return true;
    });
    if (gecerli.length === 0) return;

    setYukleniyor(true);
    setIlerleme({ tamam: 0, toplam: gecerli.length });
    const supabase = createClient();

    for (const [i, file] of gecerli.entries()) {
      const uzanti = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      // Yol MUTLAKA `{venueId}/…` ile başlamalı; Storage politikası ilk
      // klasöre bakarak yetki veriyor.
      const yol = `${venue.id}/${crypto.randomUUID()}.${uzanti}`;

      const { error } = await supabase.storage.from(BUCKET).upload(yol, file, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) {
        toast.error(`${file.name} yüklenemedi: ${error.message}`);
        continue;
      }

      const boyut = await olcuAl(file);
      const sonuc = await attachVenueImage({
        venueId: venue.id,
        storagePath: yol,
        width: boyut?.width ?? null,
        height: boyut?.height ?? null,
      });
      if (!sonuc.ok) {
        toast.error(sonuc.message);
        // Kayıt açılamadıysa Storage'daki dosyayı bırakmıyoruz.
        await supabase.storage.from(BUCKET).remove([yol]);
      }
      setIlerleme({ tamam: i + 1, toplam: gecerli.length });
    }

    setYukleniyor(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  };

  const eksik = Math.max(0, ONERILEN_ADET - venue.images.length);

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void yukle(e.dataTransfer.files);
        }}
        className="rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50"
      >
        <ImagePlus className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Fotoğrafları buraya sürükleyin</p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG, WEBP veya AVIF · en fazla 8 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={KABUL.join(",")}
          multiple
          className="sr-only"
          id="foto-secici"
          onChange={(e) => e.target.files && void yukle(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="mt-4 h-10"
          disabled={yukleniyor}
          onClick={() => inputRef.current?.click()}
        >
          {yukleniyor ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Yükleniyor ({ilerleme.tamam}/{ilerleme.toplam})
            </>
          ) : (
            "Dosya seç"
          )}
        </Button>
      </div>

      {eksik > 0 ? (
        <p className="rounded-lg bg-warning/10 px-3 py-2.5 text-sm text-warning-foreground">
          Profil tamamlanma puanı için {eksik} fotoğraf daha ekleyin
          (en az {ONERILEN_ADET} önerilir).
        </p>
      ) : null}

      {venue.images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {venue.images.map((img) => (
            <li key={img.id} className="group relative overflow-hidden rounded-lg border">
              <div className="relative aspect-[4/3] bg-muted">
                <Image
                  src={img.url}
                  alt={img.alt ?? ""}
                  fill
                  sizes="(min-width: 640px) 200px, 45vw"
                  className="object-cover"
                />
              </div>

              {img.is_cover ? (
                <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
                  Kapak
                </span>
              ) : null}

              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-brand-950/80 to-transparent p-2",
                  "opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
                )}
              >
                {!img.is_cover ? (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label="Kapak fotoğrafı yap"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await setVenueCoverImage(venue.id, img.id);
                        if (!r.ok) toast.error(r.message);
                        else {
                          toast.success("Kapak güncellendi");
                          router.refresh();
                        }
                      })
                    }
                    className="grid size-8 place-items-center rounded-md bg-background/90 backdrop-blur transition-colors hover:bg-background"
                  >
                    <Star className="size-4" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  aria-label="Fotoğrafı sil"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteVenueImage(venue.id, img.id);
                      if (!r.ok) toast.error(r.message);
                      else {
                        toast.success("Fotoğraf silindi");
                        router.refresh();
                      }
                    })
                  }
                  className="ml-auto grid size-8 place-items-center rounded-md bg-background/90 text-destructive backdrop-blur transition-colors hover:bg-background"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Görselin gerçek ölçüsü; next/image'ın blur ve layout hesabı için. */
function olcuAl(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
