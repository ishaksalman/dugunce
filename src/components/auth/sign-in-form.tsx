"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthField, AuthForm, AuthHeading } from "./auth-form";
import { signIn } from "@/lib/actions/auth";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const devam = params.get("devam");
  const hata = params.get("hata");

  return (
    <>
      <AuthHeading
        title="Giriş yap"
        description="Favorilerine, teklif taleplerine ve mekan paneline eriş."
      />

      {hata === "hesap-pasif" ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          Hesabınız askıya alınmış. Destek ile iletişime geçin.
        </p>
      ) : null}

      <AuthForm
        action={signIn}
        submitLabel="Giriş yap"
        pendingLabel="Giriş yapılıyor…"
        onSuccess={({ next }) => {
          // Açık yönlendirme (open redirect) engeli: yalnızca site içi,
          // "//" ile başlamayan yollara izin veriyoruz.
          const hedef =
            devam && devam.startsWith("/") && !devam.startsWith("//") ? devam : next;
          router.replace(hedef);
          router.refresh();
        }}
        footer={
          <div className="space-y-3 pt-2 text-center text-sm">
            <p>
              <Link href="/sifre-sifirla" className="text-primary hover:underline">
                Parolamı unuttum
              </Link>
            </p>
            <p className="text-muted-foreground">
              Hesabın yok mu?{" "}
              <Link href="/kayit" className="font-medium text-primary hover:underline">
                Kayıt ol
              </Link>
            </p>
          </div>
        }
      >
        {(errors) => (
          <>
            <AuthField
              id="giris-email"
              name="email"
              label="E-posta"
              type="email"
              autoComplete="email"
              required
              placeholder="ornek@eposta.com"
              error={errors.email}
            />
            <AuthField
              id="giris-parola"
              name="password"
              label="Parola"
              type="password"
              autoComplete="current-password"
              required
              error={errors.password}
            />
          </>
        )}
      </AuthForm>
    </>
  );
}
