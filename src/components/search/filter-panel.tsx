"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "./combobox";
import { Icon } from "@/components/shared/icon";
import { useDebounced } from "@/hooks/use-debounced";
import type { VenueFilters } from "@/lib/schemas/filters";
import type { City, EventType, VenueType } from "@/types/db";

export interface FeatureGroup {
  name: string;
  items: { id: string; slug: string; name: string; icon: string | null }[];
}

export interface FilterOptions {
  cities: City[];
  eventTypes: EventType[];
  venueTypes: VenueType[];
  featureGroups: FeatureGroup[];
}

/** Hızlı seçim için hazır fiyat aralıkları (₺). */
const PRICE_PRESETS = [
  { label: "50 bin altı", min: undefined, max: 50_000 },
  { label: "50–100 bin", min: 50_000, max: 100_000 },
  { label: "100–150 bin", min: 100_000, max: 150_000 },
  { label: "150 bin üstü", min: 150_000, max: undefined },
];

export function FilterPanel({
  filters,
  onChange,
  options,
}: {
  filters: VenueFilters;
  /** Değişiklik üst bileşene bildirilir; ne zaman URL'e yazılacağına o karar verir. */
  onChange: (next: Partial<VenueFilters>) => void;
  options: FilterOptions;
}) {
  /**
   * İlçeler şehre göre önbellekleniyor. Yükleme durumu AYRI BİR STATE DEĞİL,
   * önbellekteki şehirle seçili şehrin farkından türetiliyor — effect içinde
   * eşzamanlı `setState` çağırmak zincirleme render tetikliyor.
   */
  const [districtCache, setDistrictCache] = useState<{
    city: string;
    items: { slug: string; name: string }[];
  } | null>(null);

  const districts =
    districtCache && districtCache.city === filters.sehir ? districtCache.items : [];
  const districtsLoading =
    Boolean(filters.sehir) && districtCache?.city !== filters.sehir;

  useEffect(() => {
    const city = filters.sehir;
    if (!city) return;
    const controller = new AbortController();

    fetch(`/api/taxonomy/districts?sehir=${encodeURIComponent(city)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { districts: { slug: string; name: string }[] }) =>
        setDistrictCache({ city, items: data.districts }))
      .catch((e) => {
        if (e.name !== "AbortError") setDistrictCache({ city, items: [] });
      });

    return () => controller.abort();
  }, [filters.sehir]);

  const debouncedChange = useDebounced(onChange, 500);

  const toggleFeature = (slug: string, checked: boolean) => {
    const current = filters.ozellikler ?? [];
    const next = checked ? [...current, slug] : current.filter((s) => s !== slug);
    onChange({ ozellikler: next });
  };

  return (
    <div className="space-y-7">
      <Group label="Konum">
        <Combobox
          options={options.cities.map((c) => ({
            value: c.slug,
            label: c.name,
            hint: c.venue_count > 0 ? String(c.venue_count) : undefined,
          }))}
          value={filters.sehir}
          onChange={(v) => onChange({ sehir: v, ilce: undefined })}
          placeholder="Şehir seçin"
          searchPlaceholder="Şehir ara…"
          allLabel="Tüm şehirler"
        />
        {filters.sehir ? (
          <Combobox
            options={districts.map((d) => ({ value: d.slug, label: d.name }))}
            value={filters.ilce}
            onChange={(v) => onChange({ ilce: v })}
            placeholder={districtsLoading ? "İlçeler yükleniyor…" : "İlçe seçin"}
            searchPlaceholder="İlçe ara…"
            emptyText={districtsLoading ? "Yükleniyor…" : "İlçe bulunamadı"}
            allLabel="Tüm ilçeler"
          />
        ) : null}
      </Group>

      <Group label="Etkinlik türü">
        <Combobox
          options={options.eventTypes.map((e) => ({ value: e.slug, label: e.name }))}
          value={filters.etkinlik}
          onChange={(v) => onChange({ etkinlik: v })}
          placeholder="Etkinlik seçin"
          searchPlaceholder="Etkinlik ara…"
          allLabel="Tüm etkinlikler"
        />
      </Group>

      <Group label="Mekan türü">
        <Combobox
          options={options.venueTypes.map((t) => ({ value: t.slug, label: t.name }))}
          value={filters.tur}
          onChange={(v) => onChange({ tur: v })}
          placeholder="Mekan türü seçin"
          searchPlaceholder="Tür ara…"
          allLabel="Tüm türler"
        />
      </Group>

      <Group label="Kişi sayısı" hint="Mekanın bu sayıyı ağırlayabilmesi gerekir">
        <NumberInput
          label="Kaç kişi?"
          value={filters.kisi}
          placeholder="Örn. 250"
          onChange={(v) => debouncedChange({ kisi: v })}
        />
      </Group>

      <Group label="Kapasite aralığı">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="En az"
            value={filters.minKapasite}
            placeholder="0"
            onChange={(v) => debouncedChange({ minKapasite: v })}
          />
          <NumberInput
            label="En fazla"
            value={filters.maxKapasite}
            placeholder="Sınırsız"
            onChange={(v) => debouncedChange({ maxKapasite: v })}
          />
        </div>
      </Group>

      <Group label="Başlangıç fiyatı">
        <div className="flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((p) => {
            const active = filters.minFiyat === p.min && filters.maxFiyat === p.max;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(
                    active
                      ? { minFiyat: undefined, maxFiyat: undefined }
                      : { minFiyat: p.min, maxFiyat: p.max },
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="En az ₺"
            value={filters.minFiyat}
            placeholder="0"
            onChange={(v) => debouncedChange({ minFiyat: v })}
          />
          <NumberInput
            label="En fazla ₺"
            value={filters.maxFiyat}
            placeholder="Sınırsız"
            onChange={(v) => debouncedChange({ maxFiyat: v })}
          />
        </div>
      </Group>

      <Group label="Alan">
        <CheckRow
          checked={filters.acik ?? false}
          onChange={(c) => onChange({ acik: c || undefined })}
          label="Açık alan"
        />
        <CheckRow
          checked={filters.kapali ?? false}
          onChange={(c) => onChange({ kapali: c || undefined })}
          label="Kapalı alan"
        />
      </Group>

      {options.featureGroups.map((group) => (
        <Group key={group.name} label={group.name}>
          {group.items.map((f) => (
            <CheckRow
              key={f.id}
              checked={filters.ozellikler?.includes(f.slug) ?? false}
              onChange={(c) => toggleFeature(f.slug, c)}
              label={f.name}
              icon={f.icon}
            />
          ))}
        </Group>
      ))}
    </div>
  );
}

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  icon?: string | null;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-0.5 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      {icon ? <Icon name={icon} className="size-4 text-muted-foreground" /> : null}
      <span>{label}</span>
    </label>
  );
}

function NumberInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  onChange: (value: number | undefined) => void;
}) {
  // Debounce sırasında dışarıdan gelen değer imleci zıplatmasın diye yerel
  // taslak tutuyoruz. Prop değişince taslağı RENDER SIRASINDA sıfırlıyoruz;
  // effect ile yapmak fazladan bir render turu ve titreme demek.
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const [oncekiDeger, setOncekiDeger] = useState(value);
  if (value !== oncekiDeger) {
    setOncekiDeger(value);
    setDraft(value?.toString() ?? "");
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) && n > 0 ? n : undefined);
        }}
        className="tabular h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </label>
  );
}
