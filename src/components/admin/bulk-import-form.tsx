"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaxField, taxInput } from "./taxonomy-row";
import { commitBulkVenues, previewBulkVenues } from "@/lib/actions/bulk-import";
import { TOPLU_LIMIT, type BulkPreviewRow } from "@/lib/import/types";
import { formatNumber } from "@/lib/format";
import type { City } from "@/types/db";

interface Ilce { id: string; slug: string; name: string }

const ORNEK = `https://maps.app.goo.gl/dBBkTUonBDegJ8mS6
Bahçe Davet; 0212 111 22 33
Söğüt Kır Düğün Evi; https://maps.app.goo.gl/xxxxx`;

/**
 * Toplu katalog girişi.
 *
 * İki adım: önce ÖNİZLEME (hiçbir şey yazılmaz), sonra seçilenleri açma.
 * Önizleme isteğe bağlı değil — kötü bir yapıştırma 50 çöp kayıt açabilir
 * ve onları tek tek silmek açmaktan uzun sürer.
 */
export function BulkImportForm({ cities }: { cities: City[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cache, setCache] = useState<{ city: string; items: Ilce[] } | null>(null);
  const [metin, setMetin] = useState("");

  const [rows, setRows] = useState<BulkPreviewRow[] | null>(null);
  const [fazlalik, setFazlalik] = useState(0);
  const [secili, setSecili] = useState<Set<number>>(new Set());
  const [zorla, setZorla] = useState<Set<number>>(new Set());
  const [hata, setHata] = useState<string | null>(null);

  const districts = cache && cache.city === cityId ? cache.items : [];
  const ilceYukleniyor = cityId !== "" && cache?.city !== cityId;

  useEffect(() => {
    const city = cities.find((c) => c.id === cityId);
    if (!city) return;
    const controller = new AbortController();
    fetch(`/api/taxonomy/districts?sehir=${encodeURIComponent(city.slug)}&ayrinti=1`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { districts: Ilce[] }) => setCache({ city: cityId, items: d.districts }))
      .catch((e) => {
        if (e.name !== "AbortError") setCache({ city: cityId, items: [] });
      });
    return () => controller.abort();
  }, [cityId, cities]);

  const onizle = () =>
    startTransition(async () => {
      setHata(null);
      const r = await previewBulkVenues({ metin, cityId });
      if (!r.ok) {
        setHata(r.message);
        return;
      }
      setRows(r.data.rows);
      setFazlalik(r.data.fazlalik);
      // Hatasız satırlar baştan seçili; kullanıcı istemediğini çıkarsın.
      setSecili(new Set(r.data.rows.filter((x) => !x.hata && x.name).map((x) => x.satirNo)));
      setZorla(new Set());
    });

  const ekle = () =>
    startTransition(async () => {
      setHata(null);
      const secilenler = (rows ?? []).filter((x) => secili.has(x.satirNo) && x.name);
      const r = await commitBulkVenues({
        cityId,
        districtId,
        rows: secilenler.map((x) => ({
          name: x.name as string,
          phone: x.phone ?? undefined,
          mapsUrl: x.mapsUrl ?? undefined,
          latitude: x.latitude,
          longitude: x.longitude,
          force: zorla.has(x.satirNo),
        })),
      });
      if (!r.ok) {
        setHata(r.message);
        return;
      }
      const { eklenen, atlanan } = r.data;
      toast.success(`${formatNumber(eklenen)} katalog kaydı açıldı`, {
        description: atlanan.length > 0 ? `${atlanan.length} satır atlandı` : undefined,
      });
      if (atlanan.length > 0) {
        setHata(
          "Atlananlar: " +
            atlanan.map((a) => `${a.name} (${a.sebep})`).join(" · "),
        );
        // Atlananlar ekranda kalsın ki kullanıcı ne olduğunu görsün.
        setRows((mevcut) =>
          (mevcut ?? []).filter((x) => atlanan.some((a) => a.name === x.name)),
        );
        setSecili(new Set());
      } else {
        setRows(null);
        setMetin("");
        router.push("/yonetim/mekanlar");
      }
    });

  const degistir = (no: number, kume: Set<number>, ayarla: (s: Set<number>) => void) => {
    const yeni = new Set(kume);
    if (yeni.has(no)) yeni.delete(no);
    else yeni.add(no);
    ayarla(yeni);
  };

  return (
    <div className="max-w-4xl space-y-5">
      {hata ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {hata}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TaxField label="Şehir">
          <select
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
              setDistrictId("");
              setRows(null);
            }}
            className={taxInput}
          >
            <option value="">Şehir seçin</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </TaxField>

        <TaxField
          label="İlçe"
          hint="Bu partideki tüm kayıtlar bu ilçeye açılır."
        >
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            disabled={cityId === "" || ilceYukleniyor}
            className={taxInput}
          >
            <option value="">
              {cityId === "" ? "Önce şehir seçin" : ilceYukleniyor ? "Yükleniyor…" : "İlçe seçin"}
            </option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </TaxField>
      </div>

      <TaxField
        label="Satırlar"
        hint={`Her satır bir işletme. Google Maps bağlantısı, ad ve telefon — sırası önemli değil, ; ile ayırın. En fazla ${TOPLU_LIMIT} satır.`}
      >
        <textarea
          value={metin}
          onChange={(e) => {
            setMetin(e.target.value);
            setRows(null);
          }}
          rows={8}
          placeholder={ORNEK}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </TaxField>

      <Button
        size="lg"
        variant="outline"
        className="h-10 gap-1.5"
        disabled={pending || cityId === "" || metin.trim() === ""}
        onClick={onizle}
      >
        {pending && !rows ? "Çözülüyor…" : "Önizle"}
        <ArrowRight className="size-4" aria-hidden />
      </Button>

      {fazlalik > 0 ? (
        <p className="text-sm text-warning-foreground">
          {formatNumber(fazlalik)} satır sığmadı; ilk {TOPLU_LIMIT} satır alındı.
        </p>
      ) : null}

      {rows ? (
        <div className="space-y-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{formatNumber(secili.size)}</strong> / {formatNumber(rows.length)} satır
              seçili
            </p>
            <Button
              size="lg"
              className="h-10 gap-1.5"
              disabled={pending || secili.size === 0 || districtId === ""}
              onClick={ekle}
            >
              <Check className="size-4" aria-hidden />
              {pending ? "Açılıyor…" : "Seçilenleri ekle"}
            </Button>
          </div>

          {districtId === "" ? (
            <p className="text-sm text-warning-foreground">
              Eklemeden önce ilçe seçin.
            </p>
          ) : null}

          <ul className="space-y-2">
            {rows.map((r) => {
              const secilebilir = !r.hata && !!r.name;
              return (
                <li
                  key={r.satirNo}
                  className={`rounded-xl border p-3 ${
                    r.hata ? "border-destructive/40 bg-destructive/5" : "bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={secili.has(r.satirNo)}
                      disabled={!secilebilir}
                      onChange={() => degistir(r.satirNo, secili, setSecili)}
                      aria-label={`${r.name ?? r.ham} satırını seç`}
                      className="mt-1 size-4 rounded border-input accent-primary disabled:opacity-40"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {r.name ?? <span className="text-muted-foreground">(ad yok)</span>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {r.phone ? <span className="tabular">{r.phone}</span> : null}
                        {r.latitude !== null ? (
                          <span className="tabular">
                            {r.latitude}, {r.longitude}
                          </span>
                        ) : null}
                        {r.mapsUrl ? <span>Maps bağlantısı var</span> : null}
                      </p>

                      {r.hata ? (
                        <p className="mt-1.5 text-xs text-destructive">{r.hata}</p>
                      ) : null}

                      {r.benzer.length > 0 ? (
                        <div className="mt-2 rounded-lg bg-warning/10 px-2.5 py-2">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-warning-foreground">
                            <AlertTriangle className="size-3.5" aria-hidden />
                            Katalogda benzer kayıt
                          </p>
                          <ul className="mt-1 space-y-0.5 text-xs">
                            {r.benzer.map((b) => (
                              <li key={b.id}>
                                <Link
                                  href={`/yonetim/mekanlar/${b.id}`}
                                  target="_blank"
                                  className="hover:underline"
                                >
                                  {b.name}
                                </Link>{" "}
                                <span className="text-muted-foreground">{b.district_name}</span>
                                {b.eslesme === "telefon" ? (
                                  <span className="ml-1 rounded-full bg-warning/25 px-1.5 py-0.5 font-medium text-warning-foreground">
                                    aynı telefon
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={zorla.has(r.satirNo)}
                              onChange={() => degistir(r.satirNo, zorla, setZorla)}
                              className="size-3.5 rounded border-input accent-primary"
                            />
                            Farklı işletme, yine de ekle
                          </label>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
