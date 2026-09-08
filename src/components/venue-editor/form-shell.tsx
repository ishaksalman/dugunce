"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/errors";

/**
 * Wizard adımlarının ortak kabuğu: kaydetme, hata gösterimi, bekleme.
 *
 * Her adım tek başına kaydediliyor — kullanıcı yarıda bıraktığında
 * yazdıklarını kaybetmesin.
 */
export function StepForm({
  action,
  submitLabel = "Kaydet",
  onSaved,
  children,
  footerNote,
}: {
  action: (data: Record<string, unknown>) => Promise<ActionResult>;
  submitLabel?: string;
  onSaved?: () => void;
  children: (errors: Record<string, string>) => React.ReactNode;
  footerNote?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        // Çoklu seçim alanları (checkbox grupları) FormData'da tekrar eder;
        // adım bileşenleri kendi değerlerini gizli input olarak JSON yazıyor.
        setErrors({});
        setFormError(null);
        startTransition(async () => {
          const result = await action(data);
          if (!result.ok) {
            setErrors(result.fieldErrors ?? {});
            setFormError(result.message);
            return;
          }
          toast.success("Kaydedildi");
          onSaved?.();
        });
      }}
      className="space-y-5"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      {children(errors)}

      <div className="flex items-center gap-3 border-t pt-5">
        <Button type="submit" size="lg" disabled={pending} className="h-10">
          {pending ? "Kaydediliyor…" : submitLabel}
        </Button>
        {footerNote}
      </div>
    </form>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id?: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass = (error?: string) =>
  cn(
    "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors",
    "focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground",
    error ? "border-destructive" : "border-input",
  );
