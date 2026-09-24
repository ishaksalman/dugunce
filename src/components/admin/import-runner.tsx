"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Play, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaxField, taxInput } from "./taxonomy-row";
import {
  checkImportProcessed, finishImportRun, importOneVenue, startImportRun,
} from "@/lib/actions/import-run";
import { ORNEK_YUK, parseImportPayload, type PayloadRow } from "@/lib/import/payload";
import { formatNumber } from "@/lib/format";
import { slugifyTr } from "@/lib/slug";
import { cn } from "@/lib/utils";
import type { City, ImportStatus, VenueType } from "@/types/db";

interface Ilce { id: string; slug: string; name: string }

const EN_FAZLA = 50;

const DURUM: Record<ImportStatus, { label: string; cls: string }> = {
  imported: { label: "Aktarıldı", cls: "bg-success/15 text-success" },
  partial: { label: "Kısmi", cls: "bg-warning/15 text-warning-foreground" },
  duplicate: { label: "Mükerrer", cls: "bg-muted text-muted-foreground" },
  needs_review: { label: "İnceleme gerek", cls: "bg-warning/15 text-warning-foreground" },
  failed: { label: "Başarısız", cls: "bg-destructive/10 text-destructive" },
};

interface SatirSonuc {
  status: ImportStatus;
  venueId: string | null;
  imageOk: number;
  imageTotal: number;
  error: string | null;
}

/**
 * İçe aktarma sürücüsü.
 *
 * Satırları TEK TEK ve sırayla çalıştırıyor; her biri bittiğinde sonucu
 * ekranda beliriyor. Toplu tek çağrı yapmamanın sebebi görseller: bir
 * işletmenin galerisi dakikalar sürebiliyor ve kullanıcının nerede
 * olduğunu görmesi gerekiyor. Ayrıca bir satırın hatası diğerlerini
 * düşürmüyor.
 *
 * İlçe SATIR BAŞINA çözülüyor — eskiden tek bir global ilçe seçimi tüm
 * partiye uygulanıyordu; bir şehir çapında kazınan veri onlarca farklı
 * ilçeye yayılınca bu yanlıştı (hepsi tek ilçeye açılırdı). Şimdi her satır
 * kaynağın verdiği serbest metin ilçe adından (`row.district`) otomatik
 * eşleniyor (bkz. `otomatikIlce`); eşleşmeyen ya da yanlış eşlenen elle
 * düzeltiliyor. Otomatik eşleme yalnızca bizim taksonomimizdeki `slug` ile
 * TAM eşleşince kabul ediliyor — tahmini/bulanık eşleme YOK, yanlış ilçeye
 * kayıt açmaktansa admin'e sormak daha güvenli.
 */
export function ImportRunner({
  cities,
  venueTypes,
}: {
  cities: City[];
  venueTypes: VenueType[];
}) {
  const [pending, startTransition] = useTransition();

  const [cityId, setCityId] = useState("");
  const [cache, setCache] = useState<{ city: string; items: Ilce[] } | null>(null);
  const [kaynak, setKaynak] = useState("");
  const [metin, setMetin] = useState("");

  const [rows, setRows] = useState<PayloadRow[] | null>(null);
  const [fazlalik, setFazlalik] = useState(0);
  const [secili, setSecili] = useState<Set<number>>(new Set());
  // Satır başına ilçe: kaynağın verdiği serbest metin ilçe adından OTOMATİK
  // eşleniyor (bkz. resolveDistrictId). Bir şehirde onlarca farklı ilçeye
  // yayılan bir kazıma sonucunda tek bir global ilçe seçimi yanlış olurdu —
  // eskiden öyleydi, hepsi tek ilçeye açılıyordu. Kullanıcı burada yalnızca
  // eşleşmeyeni ya da yanlış eşleneni DÜZELTİYOR.
  const [ilceSecimi, setIlceSecimi] = useState<Map<number, string>>(new Map());
  const [sonuclar, setSonuclar] = useState<Map<number, SatirSonuc>>(new Map());
  const [calisan, setCalisan] = useState<number | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [dosyaNotu, setDosyaNotu] = useState<string | null>(null);

  const districts = cache && cache.city === cityId ? cache.items : [];
  const ilceYukleniyor = cityId !== "" && cache?.city !== cityId;

  /**
   * Resmî adı değişen ama kaynakların hâlâ eskisini verdiği ilçeler. Bulanık
   * eşleme değil — tek, bilinen bir karşılık; belirsizlik yok.
   */
  const ILCE_ALIAS: Record<string, string> = {
    eyup: "eyupsultan", // Eyüp, 2019'da Eyüpsultan oldu
  };

  /** Kaynağın verdiği serbest metin ilçe adını taksonomideki slug'a göre eşler. */
  const otomatikIlce = (district: string | null): Ilce | null => {
    if (!district) return null;
    const s = slugifyTr(district);
    const slug = ILCE_ALIAS[s] ?? s;
    return districts.find((d) => d.slug === slug) ?? null;
  };

  const ilceIcin = (row: PayloadRow): string =>
    ilceSecimi.get(row.satirNo) ?? otomatikIlce(row.district)?.id ?? "";

  /**
   * Mekan türü şehir/ilçeye bağlı değil, sabit bir taksonomi — ilçe gibi API
   * fetch'i gerekmiyor. dugun-com.ts kaynak taraftan zaten ÇÖZÜLMÜŞ bir slug
   * veriyor (`venueTypeSlug`); burada yalnızca id'ye çeviriyoruz. Eşleşmezse
   * boş kalır, admin sahiplendikten sonra kendi wizard'ından seçebilir.
   */
  const otomatikMekanTuru = (slug: string | null): VenueType | null => {
    if (!slug) return null;
    return venueTypes.find((t) => t.slug === slug) ?? null;
  };

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
      setSonuclar(new Map());
      const { rows: r, fazlalik: f, hata: h } = parseImportPayload(metin, EN_FAZLA);
      if (h) {
        setHata(h);
        return;
      }

      // Devam etme: daha önce işlenmiş kaynak adresleri işaretleniyor.
      const adresler = r.map((x) => x.sourceUrl).filter((u): u is string => !!u);
      let islenmisKume = new Set<string>();
      if (adresler.length > 0) {
        const kontrol = await checkImportProcessed(adresler);
        if (kontrol.ok) islenmisKume = new Set(kontrol.data.islenmis);
      }

      const isaretli = r.map((x) => ({
        ...x,
        islenmis: x.sourceUrl ? islenmisKume.has(x.sourceUrl) : false,
      }));

      setRows(isaretli);
      setFazlalik(f);
      setIlceSecimi(new Map());
      // İşlenmişler ve hatalılar baştan seçili DEĞİL.
      setSecili(
        new Set(isaretli.filter((x) => x.name && !x.islenmis).map((x) => x.satirNo)),
      );
    });

  const calistir = () =>
    startTransition(async () => {
      setHata(null);
      const secilenler = (rows ?? []).filter((x) => secili.has(x.satirNo) && x.name);
      if (secilenler.length === 0) return;

      const baslat = await startImportRun({ source: kaynak.trim(), note: undefined });
      if (!baslat.ok) {
        setHata(baslat.message);
        return;
      }
      const runId = baslat.data.runId;
      const yeni = new Map<number, SatirSonuc>();

      for (const satir of secilenler) {
        setCalisan(satir.satirNo);
        const r = await importOneVenue({
          runId,
          source: kaynak.trim(),
          sourceUrl: satir.sourceUrl ?? undefined,
          name: satir.name as string,
          cityId,
          districtId: ilceIcin(satir),
          venueTypeId: otomatikMekanTuru(satir.venueTypeSlug)?.id ?? undefined,
          address: satir.address,
          phone: satir.phone,
          website: satir.website,
          instagram: satir.instagram,
          placeId: satir.placeId,
          mapsUrl: satir.mapsUrl,
          latitude: satir.latitude,
          longitude: satir.longitude,
          imageUrls: satir.imageUrls,
          minCapacity: satir.minCapacity,
          maxCapacity: satir.maxCapacity,
          startingPrice: satir.startingPrice,
          priceMax: satir.priceMax,
          priceType: satir.priceType,
          priceNote: satir.priceNote,
          hasIndoor: satir.hasIndoor,
          hasOutdoor: satir.hasOutdoor,
          featureSlugs: satir.featureSlugs,
          eventTypeSlugs: satir.eventTypeSlugs,
        });

        yeni.set(
          satir.satirNo,
          r.ok
            ? {
                status: r.data.status,
                venueId: r.data.venueId,
                imageOk: r.data.imageOk,
                imageTotal: r.data.imageTotal,
                error: r.data.error,
              }
            : {
                status: "failed",
                venueId: null,
                imageOk: 0,
                imageTotal: satir.imageUrls.length,
                error: r.message,
              },
        );
        setSonuclar(new Map(yeni));
      }

      setCalisan(null);
      await finishImportRun(runId);

      const basarili = [...yeni.values()].filter(
        (s) => s.status === "imported" || s.status === "partial",
      ).length;
      toast.success(`${formatNumber(basarili)} / ${secilenler.length} işletme aktarıldı`, {
        description: "Ayrıntılar içe aktarma günlüğünde.",
      });
    });

  const secimDegistir = (no: number) => {
    const yeni = new Set(secili);
    if (yeni.has(no)) yeni.delete(no);
    else yeni.add(no);
    setSecili(yeni);
  };

  // Seçili her satırın ilçesi çözülmüş olmalı — aşağıda satır satır
  // gösteriliyor ve gerekirse elle düzeltiliyor.
  const seciliIlcesizVar =
    (rows ?? []).some((r) => secili.has(r.satirNo) && ilceIcin(r) === "");

  const hazir =
    cityId !== "" && kaynak.trim().length >= 2 && secili.size > 0 && !seciliIlcesizVar;

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
              setIlceSecimi(new Map());
            }}
            className={taxInput}
          >
            <option value="">Şehir seçin</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </TaxField>

        <TaxField label="Kaynak adı" hint="Günlükte görünür. Örn. isletme-galerisi">
          <input
            value={kaynak}
            onChange={(e) => setKaynak(e.target.value)}
            maxLength={60}
            placeholder="isletme-galerisi"
            className={taxInput}
          />
        </TaxField>
      </div>

      {cityId !== "" ? (
        <p className="text-xs text-muted-foreground">
          İlçe her satır için kaynağın verdiği ilçe adından otomatik eşleniyor
          — eşleşmeyeni aşağıdan elle seçmen gerekiyor.
        </p>
      ) : null}

      <div className="rounded-xl border border-dashed p-3.5">
        <label className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-background px-3 font-medium transition-colors hover:bg-muted">
            <Upload className="size-4" aria-hidden />
            JSON dosyası seç
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setHata(null);
                setRows(null);
                f.text().then((t) => {
                  setMetin(t);
                  setDosyaNotu(`${f.name} okundu.`);
                });
                e.target.value = "";
              }}
            />
          </span>
          <span className="text-muted-foreground">
            Ya da aşağıya yapıştırın.
          </span>
        </label>
        {dosyaNotu ? (
          <p className="mt-2 text-sm text-muted-foreground">{dosyaNotu}</p>
        ) : null}
      </div>

      <TaxField
        label="Aktarım yükü"
        hint={`İşletme başına bir nesne; name zorunlu, imageUrls isteğe bağlı. En fazla ${EN_FAZLA} kayıt.`}
      >
        <textarea
          value={metin}
          onChange={(e) => {
            setMetin(e.target.value);
            setRows(null);
            setDosyaNotu(null);
          }}
          rows={10}
          placeholder={ORNEK_YUK}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </TaxField>

      <Button
        size="lg"
        variant="outline"
        className="h-10 gap-1.5"
        disabled={pending || metin.trim() === ""}
        onClick={onizle}
      >
        {pending && !rows ? "Okunuyor…" : "Önizle"}
        <ArrowRight className="size-4" aria-hidden />
      </Button>

      {fazlalik > 0 ? (
        <p className="text-sm text-warning-foreground">
          {formatNumber(fazlalik)} kayıt sığmadı; ilk {EN_FAZLA} tanesi alındı.
        </p>
      ) : null}

      {rows ? (
        <div className="space-y-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{formatNumber(secili.size)}</strong> / {formatNumber(rows.length)}{" "}
              işletme seçili ·{" "}
              {formatNumber(
                rows.filter((r) => secili.has(r.satirNo)).reduce((n, r) => n + r.imageUrls.length, 0),
              )}{" "}
              görsel
            </p>
            <Button
              size="lg"
              className="h-10 gap-1.5"
              disabled={pending || !hazir}
              onClick={calistir}
            >
              <Play className="size-4" aria-hidden />
              {pending && calisan !== null
                ? `Aktarılıyor (${calisan}/${rows.length})…`
                : "Aktarımı başlat"}
            </Button>
          </div>

          {!hazir && secili.size > 0 ? (
            <p className="text-sm text-warning-foreground">
              {cityId === "" || kaynak.trim().length < 2
                ? "Başlatmadan önce şehir ve kaynak adını doldurun."
                : "Seçili satırlardan bazılarının ilçesi eşleşmedi — aşağıdan elle seç."}
            </p>
          ) : null}

          <ul className="space-y-2">
            {rows.map((r) => {
              const sonuc = sonuclar.get(r.satirNo);
              const secilebilir = !!r.name;
              return (
                <li
                  key={r.satirNo}
                  className={cn(
                    "rounded-xl border p-3",
                    calisan === r.satirNo && "border-primary bg-secondary/40",
                    r.islenmis && !sonuc && "bg-muted/30",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={secili.has(r.satirNo)}
                      disabled={!secilebilir || pending}
                      onChange={() => secimDegistir(r.satirNo)}
                      aria-label={`${r.name ?? "satır"} seç`}
                      className="mt-1 size-4 rounded border-input accent-primary disabled:opacity-40"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{r.name ?? "(adsız)"}</p>
                        {sonuc ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              DURUM[sonuc.status].cls,
                            )}
                          >
                            {DURUM[sonuc.status].label}
                          </span>
                        ) : r.islenmis ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            daha önce işlenmiş
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {r.phone ? <span className="tabular">{r.phone}</span> : null}
                        {r.imageUrls.length > 0 ? (
                          <span className="tabular">
                            {sonuc
                              ? `görsel ${sonuc.imageOk}/${sonuc.imageTotal}`
                              : `${r.imageUrls.length} görsel`}
                          </span>
                        ) : null}
                        {r.latitude !== null ? <span className="tabular">konum var</span> : null}
                      </p>

                      {r.sourceUrl ? (
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                          {r.sourceUrl}
                        </p>
                      ) : null}

                      {cityId !== "" && secili.has(r.satirNo) ? (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <select
                            value={ilceIcin(r)}
                            disabled={ilceYukleniyor || pending || !!sonuc}
                            onChange={(e) => {
                              const yeni = new Map(ilceSecimi);
                              yeni.set(r.satirNo, e.target.value);
                              setIlceSecimi(yeni);
                            }}
                            className={cn(
                              "h-7 rounded-md border bg-background px-1.5 text-xs outline-none",
                              ilceIcin(r) === "" && "border-warning-foreground text-warning-foreground",
                            )}
                          >
                            <option value="">
                              {ilceYukleniyor ? "İlçeler yükleniyor…" : "İlçe seçin"}
                            </option>
                            {districts.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          {ilceIcin(r) !== "" && !ilceSecimi.has(r.satirNo) ? (
                            <span className="text-[11px] text-muted-foreground">
                              “{r.district}”den otomatik
                            </span>
                          ) : ilceIcin(r) === "" && r.district ? (
                            <span className="text-[11px] text-warning-foreground">
                              “{r.district}” eşleşmedi
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {r.hata ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warning-foreground">
                          <AlertTriangle className="size-3.5" aria-hidden />
                          {r.hata}
                        </p>
                      ) : null}

                      {sonuc?.error ? (
                        <p className="mt-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                          {sonuc.error}
                        </p>
                      ) : null}

                      {sonuc?.venueId ? (
                        <Link
                          href={`/yonetim/mekanlar/${sonuc.venueId}`}
                          target="_blank"
                          className="mt-1.5 inline-block text-xs text-primary hover:underline"
                        >
                          Kaydı aç
                        </Link>
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
