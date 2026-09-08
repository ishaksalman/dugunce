"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VenueDetailImage } from "@/types/db";

/**
 * Masaüstünde mozaik (1 büyük + 4 küçük), mobilde kaydırmalı şerit.
 * Her iki durumda da tam ekran görüntüleyici açılır.
 */
export function VenueGallery({
  images,
  venueName,
}: {
  images: VenueDetailImage[];
  venueName: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-xl bg-muted text-sm text-muted-foreground">
        Bu mekan için henüz fotoğraf eklenmemiş
      </div>
    );
  }

  const [cover, ...rest] = images;
  const thumbs = rest.slice(0, 4);

  return (
    <>
      {/* --- Mobil: kaydırmalı şerit --- */}
      <div className="md:hidden">
        <SwipeStrip
          images={images}
          venueName={venueName}
          onOpen={(i) => setLightboxIndex(i)}
        />
      </div>

      {/* --- Masaüstü: mozaik --- */}
      <div className="relative hidden md:grid md:grid-cols-4 md:grid-rows-2 md:gap-2 md:rounded-xl">
        <GalleryTile
          image={cover}
          venueName={venueName}
          priority
          className="col-span-2 row-span-2"
          sizes="(min-width: 1280px) 620px, 50vw"
          onClick={() => setLightboxIndex(0)}
        />
        {thumbs.map((img, i) => (
          <GalleryTile
            key={img.id}
            image={img}
            venueName={venueName}
            sizes="(min-width: 1280px) 310px, 25vw"
            onClick={() => setLightboxIndex(i + 1)}
          />
        ))}
        {images.length > 5 ? (
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-lg bg-background/90 px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:bg-background"
          >
            <Expand className="size-4" aria-hidden />
            {images.length} fotoğrafın tümü
          </button>
        ) : null}
      </div>

      {lightboxIndex !== null ? (
        <Lightbox
          images={images}
          venueName={venueName}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </>
  );
}

function GalleryTile({
  image,
  venueName,
  className,
  sizes,
  priority,
  onClick,
}: {
  image: VenueDetailImage;
  venueName: string;
  className?: string;
  sizes: string;
  priority?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${venueName} fotoğrafını büyüt`}
      className={cn(
        "group relative aspect-[4/3] overflow-hidden bg-muted",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <Image
        src={image.url}
        alt={image.alt ?? venueName}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={image.blur ? "blur" : undefined}
        blurDataURL={image.blur ?? undefined}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </button>
  );
}

function SwipeStrip({
  images,
  venueName,
  onOpen,
}: {
  images: VenueDetailImage[];
  venueName: string;
  onOpen: (index: number) => void;
}) {
  const [ref, embla] = useEmblaCarousel({ loop: false, align: "start" });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const sync = () => setSelected(embla.selectedScrollSnap());
    sync();
    embla.on("select", sync);
    return () => {
      embla.off("select", sync);
    };
  }, [embla]);

  return (
    <div className="relative">
      <div ref={ref} className="overflow-hidden rounded-xl">
        <div className="flex">
          {images.map((img, i) => (
            <div key={img.id} className="relative aspect-[4/3] w-full shrink-0 grow-0 basis-full">
              <Image
                src={img.url}
                alt={img.alt ?? venueName}
                fill
                sizes="100vw"
                priority={i === 0}
                placeholder={img.blur ? "blur" : undefined}
                blurDataURL={img.blur ?? undefined}
                className="object-cover"
                onClick={() => onOpen(i)}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-brand-950/70 px-2.5 py-1 text-xs text-white tabular">
        {selected + 1} / {images.length}
      </div>
    </div>
  );
}

function Lightbox({
  images,
  venueName,
  startIndex,
  onClose,
}: {
  images: VenueDetailImage[];
  venueName: string;
  startIndex: number;
  onClose: () => void;
}) {
  const [ref, embla] = useEmblaCarousel({ loop: true, startIndex });
  const [selected, setSelected] = useState(startIndex);

  const prev = useCallback(() => embla?.scrollPrev(), [embla]);
  const next = useCallback(() => embla?.scrollNext(), [embla]);

  useEffect(() => {
    if (!embla) return;
    const sync = () => setSelected(embla.selectedScrollSnap());
    sync();
    embla.on("select", sync);
    return () => {
      embla.off("select", sync);
    };
  }, [embla]);

  // Klavye ile gezinme ve kapatma; galeri fare olmadan da kullanılabilmeli.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    // Arkadaki sayfa kaymasın.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, prev, next]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${venueName} fotoğrafları`}
      className="fixed inset-0 z-50 flex flex-col bg-brand-950/95 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between p-4 text-white">
        <span className="tabular text-sm">
          {selected + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Galeriyi kapat"
          autoFocus
          className="grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div ref={ref} className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full">
          {images.map((img) => (
            <div key={img.id} className="relative h-full w-full shrink-0 grow-0 basis-full">
              <Image
                src={img.url}
                alt={img.alt ?? venueName}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 p-4">
        <LightboxNav onClick={prev} label="Önceki fotoğraf">
          <ChevronLeft className="size-5" aria-hidden />
        </LightboxNav>
        <LightboxNav onClick={next} label="Sonraki fotoğraf">
          <ChevronRight className="size-5" aria-hidden />
        </LightboxNav>
      </div>
    </div>
  );
}

function LightboxNav({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
    >
      {children}
    </button>
  );
}
