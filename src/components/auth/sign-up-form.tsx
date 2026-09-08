"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { AuthField, AuthForm, AuthHeading } from "./auth-form";
import { signUp } from "@/lib/actions/auth";

export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  // /mekan-ekle akışından gelenler doğrudan mekan sahibi olarak kaydolur.
  const asOwner = params.get("tur") === "mekan-sahibi";
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-6 text-center">
        <MailCheck className="mx-auto mb-3 size-8 text-success" aria-hidden />
        <h1 className="font-heading text-xl">E-postanı doğrula</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sana bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra
          giriş yapabilirsin.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Gelen kutunda yoksa spam klasörünü kontrol et.
        </p>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title={asOwner ? "Mekan sahibi olarak kayıt ol" : "Kayıt ol"}
        description={
          asOwner
            ? "Mekanını ücretsiz listele, teklif taleplerini doğrudan al."
            : "Favorilerini kaydet, teklif taleplerini takip et."
        }
      />
      <AuthForm
        action={signUp}
        submitLabel="Kayıt ol"
        pendingLabel="Kaydediliyor…"
        onSuccess={({ needsConfirmation }) => {
          if (needsConfirmation) {
            setSent(true);
            return;
          }
          router.replace(asOwner ? "/panel/mekanim" : "/panel");
          router.refresh();
        }}
        footer={
          <p className="pt-2 text-center text-sm text-muted-foreground">
            Zaten hesabın var mı?{" "}
            <Link href="/giris" className="font-medium text-primary hover:underline">
              Giriş yap
            </Link>
          </p>
        }
      >
        {(errors) => (
          <>
            <input type="hidden" name="asOwner" value={asOwner ? "1" : ""} />
            <AuthField
              id="kayit-ad"
              name="fullName"
              label="Ad soyad"
              autoComplete="name"
              required
              placeholder="Adınız ve soyadınız"
              error={errors.fullName}
            />
            <AuthField
              id="kayit-email"
              name="email"
              label="E-posta"
              type="email"
              autoComplete="email"
              required
              placeholder="ornek@eposta.com"
              error={errors.email}
            />
            <AuthField
              id="kayit-telefon"
              name="phone"
              label="Telefon"
              type="tel"
              autoComplete="tel"
              placeholder="0555 123 45 67"
              hint="İsteğe bağlı. Mekanlar sana buradan da ulaşabilir."
              error={errors.phone}
            />
            <AuthField
              id="kayit-parola"
              name="password"
              label="Parola"
              type="password"
              autoComplete="new-password"
              required
              hint="En az 8 karakter."
              error={errors.password}
            />
          </>
        )}
      </AuthForm>
    </>
  );
}
