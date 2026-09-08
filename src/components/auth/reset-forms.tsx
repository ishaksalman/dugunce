"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, MailCheck } from "lucide-react";
import { AuthField, AuthForm, AuthHeading } from "./auth-form";
import { requestPasswordReset, updatePassword } from "@/lib/actions/auth";

export function ResetRequestForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-6 text-center">
        <MailCheck className="mx-auto mb-3 size-8 text-success" aria-hidden />
        <h1 className="font-heading text-xl">Bağlantı gönderildi</h1>
        {/* Adresin kayıtlı olup olmadığını söylemiyoruz — kullanıcı
            numaralandırmasını engellemek için mesaj her durumda aynı. */}
        <p className="mt-2 text-sm text-muted-foreground">
          Bu adres kayıtlıysa parola sıfırlama bağlantısı gönderildi. Gelen
          kutunu ve spam klasörünü kontrol et.
        </p>
        <p className="mt-5 text-sm">
          <Link href="/giris" className="text-primary hover:underline">
            Giriş sayfasına dön
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title="Parolamı unuttum"
        description="E-posta adresini gir, sana sıfırlama bağlantısı gönderelim."
      />
      <AuthForm
        action={requestPasswordReset}
        submitLabel="Sıfırlama bağlantısı gönder"
        pendingLabel="Gönderiliyor…"
        onSuccess={() => setSent(true)}
        footer={
          <p className="pt-2 text-center text-sm">
            <Link href="/giris" className="text-primary hover:underline">
              Giriş sayfasına dön
            </Link>
          </p>
        }
      >
        {(errors) => (
          <AuthField
            id="sifirla-email"
            name="email"
            label="E-posta"
            type="email"
            autoComplete="email"
            required
            placeholder="ornek@eposta.com"
            error={errors.email}
          />
        )}
      </AuthForm>
    </>
  );
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-8 text-success" aria-hidden />
        <h1 className="font-heading text-xl">Parolan güncellendi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Yeni parolanla giriş yapabilirsin.
        </p>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title="Yeni parola belirle"
        description="Bu sayfaya e-postandaki bağlantıdan geldiysen yeni parolanı belirleyebilirsin."
      />
      <AuthForm
        action={updatePassword}
        submitLabel="Parolayı güncelle"
        pendingLabel="Güncelleniyor…"
        onSuccess={() => {
          setDone(true);
          router.refresh();
        }}
      >
        {(errors) => (
          <>
            <AuthField
              id="yeni-parola"
              name="password"
              label="Yeni parola"
              type="password"
              autoComplete="new-password"
              required
              hint="En az 8 karakter."
              error={errors.password}
            />
            <AuthField
              id="yeni-parola-tekrar"
              name="passwordConfirm"
              label="Yeni parola (tekrar)"
              type="password"
              autoComplete="new-password"
              required
              error={errors.passwordConfirm}
            />
          </>
        )}
      </AuthForm>
    </>
  );
}
