"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateSeoPage } from "@/lib/actions/admin";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminSeoPage } from "@/types/db";

const TIP_ETIKET: Record<string, string> = {
  etkinlik: "Etkinlik",
  sehir: "Şehir",
  sehir_etkinlik: "Şehir × Etkinlik",
  ilce_etkinlik: "İlçe × Etkinlik",
};

export function SeoPageRow({ page }: { page: AdminSeoPage }) {
  const router = useRouter();
  const [duzenle, setDuzenle] = useState(false);
  const [pending, startTransition] = useTransition();
  const adet = Number(page.venue_count);
  const esikAlti = adet < page.min_venue_count;

  const kaydet = (patch: Record<string, unknown>) =>
    startTransition(async () => {
      const r = await updateSeoPage({ id: page.id, ...patch });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setDuzenle(false);
      toast.success("Kaydedildi");
      router.refresh();
    });

  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{page.h1}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">/{page.path}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
            {TIP_ETIKET[page.kind] ?? page.kind}
          </span>
          <span
            className={cn(
              "tabular rounded-full px-2.5 py-1 text-[11px] font-medium",
              page.is_active
                ? "bg-success/15 text-success"
                : "bg-warning/15 text-warning-foreground",
            )}
          >
            {page.is_active
              ? "İndeksleniyor"
              : `noindex · ${formatNumber(adet)}/${page.min_venue_count} mekan`}
          </span>
        </div>
      </div>

      {duzenle ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            kaydet({
              title: f.get("title"),
              metaDescription: f.get("metaDescription"),
              h1: f.get("h1"),
              introHtml: f.get("introHtml"),
              minVenueCount: f.get("minVenueCount"),
            });
          }}
        >
          <Alan ad="h1" etiket="H1" varsayilan={page.h1} />
          <Alan ad="title" etiket="Başlık (title)" varsayilan={page.title} />
          <Alan
            ad="metaDescription"
            etiket="Meta açıklama"
            varsayilan={page.meta_description ?? ""}
            cokSatir
          />
          <Alan
            ad="introHtml"
            etiket="Giriş metni (HTML)"
            varsayilan={page.intro_html ?? ""}
            cokSatir
            ipucu="Sayfaya özgün içerik ekler. Boş bırakılırsa gösterilmez."
          />
          <Alan
            ad="minVenueCount"
            etiket="İndeksleme eşiği (mekan sayısı)"
            varsayilan={String(page.min_venue_count)}
            tip="number"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-9" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9"
              disabled={pending}
              onClick={() => setDuzenle(false)}
            >
              Vazgeç
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {page.meta_description ?? "Meta açıklama yok"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setDuzenle(true)}
            >
              <Pencil className="size-3.5" aria-hidden />
              Düzenle
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={pending || (esikAlti && !page.is_active)}
              onClick={() => kaydet({ isActive: !page.is_active })}
            >
              {page.is_active ? "İndekslemeyi kapat" : "İndekslemeyi aç"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5"
              nativeButton={false}
              render={
                <Link href={`/${page.path}`} target="_blank">
                  Sayfayı gör
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              }
            />
            {esikAlti && !page.is_active ? (
              <span className="text-xs text-muted-foreground">
                Eşiğin altında — açmak için eşiği düşürün
              </span>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}

function Alan({
  ad,
  etiket,
  varsayilan,
  cokSatir,
  tip = "text",
  ipucu,
}: {
  ad: string;
  etiket: string;
  varsayilan: string;
  cokSatir?: boolean;
  tip?: string;
  ipucu?: string;
}) {
  const sinif =
    "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <div>
      <label htmlFor={ad} className="mb-1 block text-xs font-medium">
        {etiket}
      </label>
      {cokSatir ? (
        <textarea id={ad} name={ad} rows={3} defaultValue={varsayilan} className={sinif} />
      ) : (
        <input id={ad} name={ad} type={tip} defaultValue={varsayilan} className={sinif} />
      )}
      {ipucu ? <p className="mt-1 text-xs text-muted-foreground">{ipucu}</p> : null}
    </div>
  );
}
