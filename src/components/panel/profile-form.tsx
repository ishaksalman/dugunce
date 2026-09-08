"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/components/auth/auth-form";
import { updateProfile } from "@/lib/actions/profile";

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setErrors({});
        startTransition(async () => {
          const result = await updateProfile(data);
          if (!result.ok) {
            setErrors(result.fieldErrors ?? {});
            toast.error(result.message);
            return;
          }
          toast.success("Profiliniz güncellendi");
        });
      }}
      className="space-y-4"
    >
      <AuthField
        id="profil-ad"
        name="fullName"
        label="Ad soyad"
        autoComplete="name"
        required
        defaultValue={fullName}
        error={errors.fullName}
      />
      <AuthField
        id="profil-telefon"
        name="phone"
        label="Telefon"
        type="tel"
        autoComplete="tel"
        defaultValue={phone ?? ""}
        placeholder="0555 123 45 67"
        error={errors.phone}
      />
      <Button type="submit" disabled={pending} size="lg" className="h-10">
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </form>
  );
}
