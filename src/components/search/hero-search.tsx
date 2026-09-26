"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "./combobox";
import { filtersToQuery } from "@/lib/schemas/filters";
import type { City, EventType } from "@/types/db";

/**
 * Ana sayfadaki arama kutusu. Kendi başına sorgu çalıştırmaz; filtreleri
 * URL'e yazıp /mekanlar'a gönderir — böylece arama sonucu paylaşılabilir
 * ve geri tuşu beklendiği gibi çalışır.
 */
export function HeroSearch({
  cities,
  eventTypes,
}: {
  cities: City[];
  eventTypes: EventType[];
}) {
  const router = useRouter();
  const [sehir, setSehir] = useState<string>();
  const [etkinlik, setEtkinlik] = useState<string>();
  const [kisi, setKisi] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(kisi, 10);
    const query = filtersToQuery({
      sehir,
      etkinlik,
      kisi: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    });
    const qs = query.toString();
    router.push(qs ? `/mekanlar?${qs}` : "/mekanlar");
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-lg bg-background p-2 shadow-lg ring-1 ring-foreground/10"
      role="search"
      aria-label="Mekan ara"
    >
      <div className="grid gap-2 md:grid-cols-[1.2fr_1.2fr_0.8fr_auto]">
        <Field label="Şehir" htmlFor="hero-sehir">
          <Combobox
            id="hero-sehir"
            options={cities.map((c) => ({
              value: c.slug,
              label: c.name,
              hint: c.venue_count > 0 ? `${c.venue_count} mekan` : undefined,
            }))}
            value={sehir}
            onChange={setSehir}
            placeholder="Şehir seçin"
            searchPlaceholder="Şehir ara…"
            allLabel="Tüm şehirler"
            className="border-transparent hover:bg-muted"
          />
        </Field>

        <Field label="Etkinlik türü" htmlFor="hero-etkinlik">
          <Combobox
            id="hero-etkinlik"
            options={eventTypes.map((e) => ({ value: e.slug, label: e.name }))}
            value={etkinlik}
            onChange={setEtkinlik}
            placeholder="Etkinlik seçin"
            searchPlaceholder="Etkinlik ara…"
            allLabel="Tüm etkinlikler"
            className="border-transparent hover:bg-muted"
          />
        </Field>

        <Field label="Kişi sayısı" htmlFor="hero-kisi">
          <input
            id="hero-kisi"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            value={kisi}
            onChange={(e) => setKisi(e.target.value)}
            placeholder="Örn. 250"
            className="tabular h-12 w-full rounded-lg border border-transparent bg-transparent px-3 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
          />
        </Field>

        <Button type="submit" size="lg" className="h-12 gap-2 px-6 md:h-full md:self-end">
          <Search className="size-4" aria-hidden />
          Mekan Ara
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="block px-3 pt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
