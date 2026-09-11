"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Taksonomi satırlarının ortak kabuğu.
 *
 * Dört farklı varlık (etkinlik türü, mekan türü, özellik, ilçe) aynı
 * etkileşimi paylaşıyor: satırı aç, alanları düzenle, kaydet. Her biri için
 * ayrı bileşen yazmak dördünü ayrı ayrı bozulur hale getirirdi.
 */
export function TaxonomyRow({
  baslik,
  slug,
  rozetler,
  kullanim,
  pasif,
  action,
  children,
}: {
  baslik: string;
  slug?: string;
  rozetler?: ReactNode;
  kullanim?: number;
  pasif?: boolean;
  action: (data: Record<string, unknown>) => Promise<ActionResult>;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  const [acik, setAcik] = useState(false);

  return (
    <li
      className={cn(
        "rounded-xl border bg-card transition-colors",
        pasif && "border-dashed bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <p className={cn("font-medium", pasif && "text-muted-foreground")}>
            {baslik}
            {pasif ? (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                Pasif
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {slug ? <code className="font-mono">{slug}</code> : null}
            {rozetler}
            {kullanim !== undefined ? (
              <span className="tabular">{formatNumber(kullanim)} mekanda</span>
            ) : null}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setAcik((v) => !v)}
          aria-expanded={acik}
        >
          {acik ? <X className="size-3.5" aria-hidden /> : <Pencil className="size-3.5" aria-hidden />}
          {acik ? "Kapat" : "Düzenle"}
        </Button>
      </div>

      {acik ? (
        <TaxonomyForm action={action} onDone={() => setAcik(false)}>
          {children}
        </TaxonomyForm>
      ) : null}
    </li>
  );
}

/** Yeni satır ekleme kutusu — aynı formu kullanır, açılış durumu farklı. */
export function TaxonomyCreate({
  etiket,
  action,
  children,
}: {
  etiket: string;
  action: (data: Record<string, unknown>) => Promise<ActionResult>;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  const [acik, setAcik] = useState(false);

  if (!acik) {
    return (
      <Button variant="outline" className="h-10 gap-1.5" onClick={() => setAcik(true)}>
        <Plus className="size-4" aria-hidden />
        {etiket}
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-dashed bg-card">
      <div className="flex items-center justify-between border-b px-3.5 py-2.5">
        <p className="text-sm font-medium">{etiket}</p>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
      <TaxonomyForm action={action} onDone={() => setAcik(false)} yeni>
        {children}
      </TaxonomyForm>
    </div>
  );
}

function TaxonomyForm({
  action,
  onDone,
  yeni,
  children,
}: {
  action: (data: Record<string, unknown>) => Promise<ActionResult>;
  onDone: () => void;
  yeni?: boolean;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="space-y-4 border-t p-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        // Checkbox işaretli değilse FormData'da HİÇ görünmüyor; şemalar
        // bunu `default(false)` ile karşılıyor.
        const data = Object.fromEntries(new FormData(form));
        setErrors({});
        setFormError(null);
        startTransition(async () => {
          const r = await action(data);
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            setFormError(r.message);
            return;
          }
          if (yeni) form.reset();
          toast.success("Kaydedildi");
          onDone();
          router.refresh();
        });
      }}
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      {children(errors)}

      <Button type="submit" size="sm" className="h-9" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </form>
  );
}

// --- Ortak alan bileşenleri --------------------------------------------------

export function TaxField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export const taxInput =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function TaxCheckbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-input accent-primary"
      />
      {label}
    </label>
  );
}
