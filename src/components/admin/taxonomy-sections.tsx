"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { toast } from "sonner";
import {
  TaxCheckbox, TaxField, TaxonomyCreate, TaxonomyRow, taxInput,
} from "./taxonomy-row";
import {
  saveDistrict, saveEventType, saveFeature, saveVenueType, setCityPopular,
} from "@/lib/actions/admin";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdminCity, AdminDistrict, AdminEventType, AdminFeature, AdminVenueType,
} from "@/types/db";

/**
 * Slug uyarısı — dört yerde tekrar ediyor çünkü dört yerde de aynı tuzak var.
 * Slug oluşturulurken addan üretiliyor ve bir daha DEĞİŞMİYOR.
 */
function SlugNotu({ neden }: { neden: string }) {
  return (
    <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      Adres (slug) ilk kayıtta addan üretilir ve sonra değişmez — {neden}
    </p>
  );
}

// --- Etkinlik türleri --------------------------------------------------------

export function EventTypesSection({ items }: { items: AdminEventType[] }) {
  function alanlar(v: Partial<AdminEventType>, errors: Record<string, string>) {
    return (
      <>
        <input type="hidden" name="id" value={v.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TaxField label="Ad" error={errors.name}>
            <input name="name" defaultValue={v.name ?? ""} className={taxInput} />
          </TaxField>
          <TaxField
            label="Cümle içindeki hâli"
            error={errors.seoNoun}
            hint="Küçük harfle: “İstanbul’da düğün için…”"
          >
            <input name="seoNoun" defaultValue={v.seo_noun ?? ""} className={taxInput} />
          </TaxField>
          <TaxField label="İkon" error={errors.icon} hint="lucide ikon adı (isteğe bağlı)">
            <input name="icon" defaultValue={v.icon ?? ""} className={taxInput} />
          </TaxField>
          <TaxField label="Sıra" error={errors.sortOrder}>
            <input
              name="sortOrder"
              type="number"
              defaultValue={v.sort_order ?? 0}
              className={`${taxInput} tabular`}
            />
          </TaxField>
        </div>
        <TaxCheckbox name="isActive" label="Aktif (vitrinde görünsün)" defaultChecked={v.is_active ?? true} />
        <SlugNotu neden="SEO adreslerinin parçası (/istanbul-dugun-mekanlari)." />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {items.map((e) => (
          <TaxonomyRow
            key={e.id}
            baslik={e.name}
            slug={e.slug}
            kullanim={Number(e.venue_count)}
            pasif={!e.is_active}
            action={saveEventType}
          >
            {(errors) => alanlar(e, errors)}
          </TaxonomyRow>
        ))}
      </ul>
      <TaxonomyCreate etiket="Etkinlik türü ekle" action={saveEventType}>
        {(errors) => alanlar({ is_active: true, sort_order: items.length * 10 }, errors)}
      </TaxonomyCreate>
    </div>
  );
}

// --- Mekan türleri -----------------------------------------------------------

export function VenueTypesSection({ items }: { items: AdminVenueType[] }) {
  function alanlar(v: Partial<AdminVenueType>, errors: Record<string, string>) {
    return (
      <>
        <input type="hidden" name="id" value={v.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TaxField label="Ad" error={errors.name}>
            <input name="name" defaultValue={v.name ?? ""} className={taxInput} />
          </TaxField>
          <TaxField label="Sıra" error={errors.sortOrder}>
            <input
              name="sortOrder"
              type="number"
              defaultValue={v.sort_order ?? 0}
              className={`${taxInput} tabular`}
            />
          </TaxField>
        </div>
        <TaxCheckbox name="isActive" label="Aktif" defaultChecked={v.is_active ?? true} />
        <SlugNotu neden="mekan filtresinde adres parametresi olarak kullanılıyor." />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {items.map((t) => (
          <TaxonomyRow
            key={t.id}
            baslik={t.name}
            slug={t.slug}
            kullanim={Number(t.venue_count)}
            pasif={!t.is_active}
            action={saveVenueType}
          >
            {(errors) => alanlar(t, errors)}
          </TaxonomyRow>
        ))}
      </ul>
      <TaxonomyCreate etiket="Mekan türü ekle" action={saveVenueType}>
        {(errors) => alanlar({ is_active: true, sort_order: items.length * 10 }, errors)}
      </TaxonomyCreate>
    </div>
  );
}

// --- Özellik ve hizmetler ----------------------------------------------------

const KIND_ETIKET = { ozellik: "Özellik", hizmet: "Hizmet" } as const;

export function FeaturesSection({ items }: { items: AdminFeature[] }) {
  // Mevcut grup adları öneri olarak sunuluyor; serbest metin ama pratikte
  // aynı grubu iki farklı yazımla açmak filtre panelini ikiye böler.
  const gruplar = [...new Set(items.map((f) => f.group_name))];

  function alanlar(v: Partial<AdminFeature>, errors: Record<string, string>) {
    return (
      <>
        <input type="hidden" name="id" value={v.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TaxField label="Ad" error={errors.name}>
            <input name="name" defaultValue={v.name ?? ""} className={taxInput} />
          </TaxField>
          <TaxField label="Tür" error={errors.kind}>
            <select name="kind" defaultValue={v.kind ?? "ozellik"} className={taxInput}>
              <option value="ozellik">Özellik</option>
              <option value="hizmet">Hizmet</option>
            </select>
          </TaxField>
          <TaxField label="Grup" error={errors.groupName} hint="Filtre panelinde başlık olur">
            <input
              name="groupName"
              defaultValue={v.group_name ?? ""}
              list="taksonomi-gruplar"
              className={taxInput}
            />
          </TaxField>
          <TaxField label="Sıra" error={errors.sortOrder}>
            <input
              name="sortOrder"
              type="number"
              defaultValue={v.sort_order ?? 0}
              className={`${taxInput} tabular`}
            />
          </TaxField>
          <TaxField label="İkon" error={errors.icon} hint="lucide ikon adı (isteğe bağlı)">
            <input name="icon" defaultValue={v.icon ?? ""} className={taxInput} />
          </TaxField>
        </div>
        <div className="flex flex-wrap gap-4">
          <TaxCheckbox name="isFilter" label="Filtre panelinde göster" defaultChecked={v.is_filter ?? true} />
          <TaxCheckbox name="isActive" label="Aktif" defaultChecked={v.is_active ?? true} />
        </div>
        <SlugNotu neden="mekanlardaki okuma kopyası (feature_slugs) ona göre yazılıyor." />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <datalist id="taksonomi-gruplar">
        {gruplar.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <ul className="space-y-2">
        {items.map((f) => (
          <TaxonomyRow
            key={f.id}
            baslik={f.name}
            slug={f.slug}
            kullanim={Number(f.venue_count)}
            pasif={!f.is_active}
            rozetler={
              <>
                <span>{KIND_ETIKET[f.kind]}</span>
                <span>· {f.group_name}</span>
                {f.is_filter ? <span>· filtrede</span> : null}
              </>
            }
            action={saveFeature}
          >
            {(errors) => alanlar(f, errors)}
          </TaxonomyRow>
        ))}
      </ul>
      <TaxonomyCreate etiket="Özellik ekle" action={saveFeature}>
        {(errors) => alanlar({ is_active: true, is_filter: true, kind: "ozellik", sort_order: items.length * 10 }, errors)}
      </TaxonomyCreate>
    </div>
  );
}

// --- Şehirler ----------------------------------------------------------------

export function CitiesSection({ items }: { items: AdminCity[] }) {
  const populer = items.filter((c) => c.is_popular).length;

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        81 il sabit: ad, plaka ve adresleri değişmiyor. Buradan yalnızca ana
        sayfadaki <strong className="text-foreground">popüler şehirler</strong> bloğu
        yönetiliyor — şu an {populer} şehir seçili. İlçe eklemek için şehre girin.
      </p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((c) => (
          <CityRow key={c.id} city={c} />
        ))}
      </ul>
    </div>
  );
}

function CityRow({ city }: { city: AdminCity }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-center gap-2 rounded-xl border bg-card p-2.5">
      <button
        type="button"
        disabled={pending}
        aria-pressed={city.is_popular}
        aria-label={`${city.name} popüler şehirlerde`}
        onClick={() =>
          startTransition(async () => {
            const r = await setCityPopular({ cityId: city.id, popular: !city.is_popular });
            if (!r.ok) {
              toast.error(r.message);
              return;
            }
            router.refresh();
          })
        }
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
          city.is_popular
            ? "border-primary bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        <Star className={cn("size-4", city.is_popular && "fill-current")} aria-hidden />
      </button>

      <Link
        href={`/yonetim/taksonomi/${city.id}`}
        className="group flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1.5 py-1 hover:bg-muted"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            <span className="tabular text-muted-foreground">{city.plate_code}</span> {city.name}
          </span>
          <span className="tabular block text-xs text-muted-foreground">
            {formatNumber(Number(city.district_count))} ilçe ·{" "}
            {formatNumber(Number(city.venue_count))} mekan
          </span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}

// --- İlçeler (şehir alt sayfası) ---------------------------------------------

export function DistrictsSection({
  cityId,
  items,
}: {
  cityId: string;
  items: AdminDistrict[];
}) {
  function alanlar(v: Partial<AdminDistrict>, errors: Record<string, string>) {
    return (
      <>
        <input type="hidden" name="id" value={v.id ?? ""} />
        <input type="hidden" name="cityId" value={cityId} />
        <TaxField label="Ad" error={errors.name}>
          <input name="name" defaultValue={v.name ?? ""} className={taxInput} />
        </TaxField>
        <SlugNotu neden="mekan adreslerinin parçası (/mekanlar/istanbul/beylikduzu/…)." />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((d) => (
          <TaxonomyRow
            key={d.id}
            baslik={d.name}
            slug={d.slug}
            kullanim={Number(d.venue_count)}
            action={saveDistrict}
          >
            {(errors) => alanlar(d, errors)}
          </TaxonomyRow>
        ))}
      </ul>
      <TaxonomyCreate etiket="İlçe ekle" action={saveDistrict}>
        {(errors) => alanlar({}, errors)}
      </TaxonomyCreate>
    </div>
  );
}
