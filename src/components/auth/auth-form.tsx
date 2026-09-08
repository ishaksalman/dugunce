"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

/** Auth formlarının ortak kabuğu: hata gösterimi, bekleme durumu, alanlar. */
export function AuthForm<T>({
  action,
  onSuccess,
  submitLabel,
  pendingLabel,
  children,
  footer,
}: {
  action: (input: Record<string, unknown>) => Promise<ActionResult<T>>;
  onSuccess: (data: T) => void;
  submitLabel: string;
  pendingLabel: string;
  children: (errors: Record<string, string>) => React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setFormError(null);
        setFieldErrors({});
        startTransition(async () => {
          const result = await action(data);
          if (result.ok) {
            onSuccess(result.data);
            return;
          }
          setFormError(result.message);
          setFieldErrors(result.fieldErrors ?? {});
        });
      }}
      className="space-y-4"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      {children(fieldErrors)}

      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
        {pending ? pendingLabel : submitLabel}
      </Button>

      {footer}
    </form>
  );
}

export function AuthField({
  id,
  name,
  label,
  type = "text",
  error,
  autoComplete,
  required,
  placeholder,
  hint,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-hata` : hint ? `${id}-ipucu` : undefined}
        className={cn(
          "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors",
          "focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground",
          error ? "border-destructive" : "border-input",
        )}
      />
      {error ? (
        <p id={`${id}-hata`} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-ipucu`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="font-heading text-2xl">{title}</h1>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
