"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader,
  DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterPanel, type FilterOptions } from "./filter-panel";
import { filtersToQuery, hasActiveFilters, type VenueFilters } from "@/lib/schemas/filters";
import { SORT_OPTIONS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";

function useFilterNavigation(filters: VenueFilters) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const commit = useCallback(
    (next: Partial<VenueFilters>) => {
      // Filtre değişince her zaman ilk sayfaya dön: 7. sayfadayken filtre
      // daraltmak kullanıcıyı boş bir sayfaya düşürürdü.
      const merged = { ...filters, ...next, sayfa: 1 };
      const qs = filtersToQuery(merged).toString();
      startTransition(() => {
        // `replace`: her filtre dokunuşu geçmişe bir kayıt eklemesin.
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [filters, pathname, router],
  );

  return { commit, pending };
}

/** Masaüstü: sol sütun, her değişiklik anında uygulanır. */
export function FilterSidebar({
  filters,
  options,
}: {
  filters: VenueFilters;
  options: FilterOptions;
}) {
  const { commit, pending } = useFilterNavigation(filters);

  return (
    <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-medium">Filtreler</h2>
        <ClearButton filters={filters} onClear={() => commit(emptyFilters())} />
      </div>
      <FilterPanel filters={filters} onChange={commit} options={options} />
    </div>
  );
}

/**
 * Mobil: sticky "Filtrele" düğmesi bir drawer açar. Burada değişiklikler
 * anında uygulanmaz — kullanıcı seçimlerini bitirip "Sonuçları göster"e
 * basar. Her dokunuşta liste altında değişseydi kafa karıştırıcı olurdu.
 */
export function FilterDrawer({
  filters,
  options,
  total,
}: {
  filters: VenueFilters;
  options: FilterOptions;
  total: number;
}) {
  const { commit } = useFilterNavigation(filters);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VenueFilters>(filters);

  const activeCount = useMemo(() => countActive(filters), [filters]);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(filters);
      }}
      showSwipeHandle
    >
      <DrawerTrigger
        render={
          <Button size="lg" className="h-12 gap-2 px-5 shadow-lg">
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtrele
            {activeCount > 0 ? (
              <span className="tabular ml-0.5 grid size-5 place-items-center rounded-full bg-primary-foreground text-[11px] text-primary">
                {activeCount}
              </span>
            ) : null}
          </Button>
        }
      />
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle>Filtreler</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <FilterPanel
            filters={draft}
            onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
            options={options}
          />
        </div>
        <DrawerFooter className="flex-row gap-2 border-t">
          <Button
            variant="outline"
            size="lg"
            className="h-11 flex-1"
            onClick={() => setDraft(emptyFilters())}
          >
            Temizle
          </Button>
          <DrawerClose
            render={
              <Button
                size="lg"
                className="h-11 flex-[2]"
                onClick={() => {
                  commit(draft);
                  setOpen(false);
                }}
              >
                {total > 0 ? `${formatNumber(total)} mekanı göster` : "Sonuçları göster"}
              </Button>
            }
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function SortSelect({ filters }: { filters: VenueFilters }) {
  const { commit } = useFilterNavigation(filters);
  return (
    <Select
      value={filters.siralama}
      onValueChange={(v) => commit({ siralama: v as VenueFilters["siralama"] })}
    >
      <SelectTrigger className="h-10 w-full sm:w-56" aria-label="Sıralama">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Uygulanmış filtreleri tek tek kaldırılabilir rozetler hâlinde gösterir. */
export function ActiveFilterChips({
  filters,
  options,
}: {
  filters: VenueFilters;
  options: FilterOptions;
}) {
  const { commit } = useFilterNavigation(filters);
  if (!hasActiveFilters(filters)) return null;

  const chips: { key: string; label: string; clear: Partial<VenueFilters> }[] = [];
  const nameOf = <T extends { slug: string; name: string }>(list: T[], slug?: string) =>
    list.find((x) => x.slug === slug)?.name ?? slug;

  if (filters.sehir) {
    chips.push({
      key: "sehir",
      label: nameOf(options.cities, filters.sehir)!,
      clear: { sehir: undefined, ilce: undefined },
    });
  }
  if (filters.ilce) chips.push({ key: "ilce", label: filters.ilce, clear: { ilce: undefined } });
  if (filters.etkinlik) {
    chips.push({
      key: "etkinlik",
      label: nameOf(options.eventTypes, filters.etkinlik)!,
      clear: { etkinlik: undefined },
    });
  }
  if (filters.tur) {
    chips.push({
      key: "tur",
      label: nameOf(options.venueTypes, filters.tur)!,
      clear: { tur: undefined },
    });
  }
  if (filters.kisi) {
    chips.push({ key: "kisi", label: `${formatNumber(filters.kisi)} kişi`, clear: { kisi: undefined } });
  }
  if (filters.minKapasite || filters.maxKapasite) {
    chips.push({
      key: "kapasite",
      label: `Kapasite ${filters.minKapasite ?? 0}–${filters.maxKapasite ?? "∞"}`,
      clear: { minKapasite: undefined, maxKapasite: undefined },
    });
  }
  if (filters.minFiyat || filters.maxFiyat) {
    chips.push({
      key: "fiyat",
      label: `₺${formatNumber(filters.minFiyat ?? 0)} – ${
        filters.maxFiyat ? `₺${formatNumber(filters.maxFiyat)}` : "∞"
      }`,
      clear: { minFiyat: undefined, maxFiyat: undefined },
    });
  }
  if (filters.acik) chips.push({ key: "acik", label: "Açık alan", clear: { acik: undefined } });
  if (filters.kapali) chips.push({ key: "kapali", label: "Kapalı alan", clear: { kapali: undefined } });
  if (filters.q) chips.push({ key: "q", label: `"${filters.q}"`, clear: { q: undefined } });

  const featureNames = new Map(
    options.featureGroups.flatMap((g) => g.items.map((i) => [i.slug, i.name] as const)),
  );
  for (const slug of filters.ozellikler ?? []) {
    chips.push({
      key: `ozellik-${slug}`,
      label: featureNames.get(slug) ?? slug,
      clear: { ozellikler: (filters.ozellikler ?? []).filter((s) => s !== slug) },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => commit(c.clear)}
          className="inline-flex items-center gap-1.5 rounded-full border bg-background py-1.5 pl-3 pr-2 text-xs transition-colors hover:bg-muted"
        >
          {c.label}
          <X className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="sr-only">filtresini kaldır</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => commit(emptyFilters())}
        className="px-2 text-xs font-medium text-primary hover:underline"
      >
        Tümünü temizle
      </button>
    </div>
  );
}

function ClearButton({
  filters,
  onClear,
}: {
  filters: VenueFilters;
  onClear: () => void;
}) {
  if (!hasActiveFilters(filters)) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      className="text-xs font-medium text-primary hover:underline"
    >
      Temizle
    </button>
  );
}

function countActive(f: VenueFilters): number {
  let n = 0;
  for (const key of ["sehir","ilce","etkinlik","tur","kisi","minKapasite","maxKapasite","minFiyat","maxFiyat","q"] as const) {
    if (f[key]) n++;
  }
  if (f.acik) n++;
  if (f.kapali) n++;
  n += f.ozellikler?.length ?? 0;
  return n;
}

function emptyFilters(): VenueFilters {
  return { siralama: "onerilen", sayfa: 1 } as VenueFilters;
}
