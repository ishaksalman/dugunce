"use client";

import { useId, useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitInquiry } from "@/lib/actions/inquiry";
import { cn } from "@/lib/utils";
import type { EventType } from "@/types/db";

/**
 * Teklif talebi formu. Üyelik gerektirmez.
 *
 * Doğrulama hem burada (anında geri bildirim) hem sunucuda (asıl kapı)
 * aynı zod şemasıyla yapılıyor. Hız sınırı veritabanında.
 */
export function InquiryForm({
  venueId,
  venueName,
  eventTypes,
  compact = false,
}: {
  venueId: string;
  venueName: string;
  eventTypes: EventType[];
  /** Drawer içinde başlığı gizler. */
  compact?: boolean;
}) {
  const uid = useId();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (sent) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-8 text-success" aria-hidden />
        <h3 className="font-heading text-lg">Talebiniz iletildi</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {venueName} en kısa sürede sizinle iletişime geçecek. Talebinizin bir
          kopyası mekana gönderildi.
        </p>
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setFormError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await submitInquiry({
        venueId,
        fullName: form.get("fullName"),
        phone: form.get("phone"),
        email: form.get("email"),
        eventTypeId: form.get("eventTypeId"),
        eventDate: form.get("eventDate"),
        guestCount: form.get("guestCount"),
        message: form.get("message"),
        website: form.get("website"),
      });

      if (result.ok) {
        setSent(true);
        return;
      }
      setFormError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {!compact ? (
        <div className="pb-1">
          <h3 className="font-heading text-lg">Bu Mekandan Teklif Al</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ücretsiz ve bağlayıcı değil. Mekan doğrudan sizinle iletişime geçer.
          </p>
        </div>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <Field id={`${uid}-name`} label="Ad soyad" error={fieldErrors.fullName} required>
        <input
          id={`${uid}-name`}
          name="fullName"
          autoComplete="name"
          required
          placeholder="Adınız ve soyadınız"
          className={inputClass(fieldErrors.fullName)}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${uid}-phone`} label="Telefon" error={fieldErrors.phone} required>
          <input
            id={`${uid}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="0555 123 45 67"
            className={inputClass(fieldErrors.phone)}
          />
        </Field>
        <Field id={`${uid}-email`} label="E-posta" error={fieldErrors.email} optional>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ornek@eposta.com"
            className={inputClass(fieldErrors.email)}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${uid}-event`} label="Etkinlik türü" error={fieldErrors.eventTypeId} optional>
          <select
            id={`${uid}-event`}
            name="eventTypeId"
            defaultValue=""
            className={inputClass(fieldErrors.eventTypeId)}
          >
            <option value="">Seçiniz</option>
            {eventTypes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${uid}-date`} label="Etkinlik tarihi" error={fieldErrors.eventDate} optional>
          <input
            id={`${uid}-date`}
            name="eventDate"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            className={inputClass(fieldErrors.eventDate)}
          />
        </Field>
      </div>

      <Field
        id={`${uid}-guests`}
        label="Tahmini kişi sayısı"
        error={fieldErrors.guestCount}
        optional
      >
        <input
          id={`${uid}-guests`}
          name="guestCount"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          placeholder="Örn. 250"
          className={cn(inputClass(fieldErrors.guestCount), "tabular")}
        />
      </Field>

      <Field id={`${uid}-message`} label="Mesajınız" error={fieldErrors.message} optional>
        <textarea
          id={`${uid}-message`}
          name="message"
          rows={3}
          maxLength={2000}
          placeholder="Tarih esnekliği, menü tercihi, merak ettikleriniz…"
          className={cn(inputClass(fieldErrors.message), "h-auto py-2.5 leading-relaxed")}
        />
      </Field>

      {/* Bal küpü: ekran okuyucudan ve gözden gizli, botlar doldurur. */}
      <div aria-hidden className="absolute left-[-9999px] size-px overflow-hidden">
        <label htmlFor={`${uid}-website`}>Web siteniz</label>
        <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="h-12 w-full gap-2">
        {pending ? (
          "Gönderiliyor…"
        ) : (
          <>
            <Send className="size-4" aria-hidden />
            Teklif Talebi Gönder
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Bilgileriniz yalnızca bu mekanla paylaşılır.
      </p>
    </form>
  );
}

function inputClass(error?: string) {
  return cn(
    "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors",
    "focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground",
    error ? "border-destructive" : "border-input",
  );
}

function Field({
  id,
  label,
  error,
  required,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
        {optional ? (
          <span className="font-normal text-muted-foreground"> (isteğe bağlı)</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
