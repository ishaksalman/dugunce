import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { ProfileForm } from "@/components/panel/profile-form";

export const metadata: Metadata = {
  title: "Ayarlar",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await requireRole(["venue_owner", "admin"], "/panel/ayarlar");

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl">Ayarlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hesap bilgilerinizi güncelleyin.
        </p>
      </header>

      <div className="max-w-lg space-y-6">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 font-medium">Profil</h2>
          <ProfileForm fullName={user.fullName} phone={user.phone} />
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-1 font-medium">E-posta</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            E-posta adresi değişikliği için destek ile iletişime geçin.
          </p>
        </section>
      </div>
    </div>
  );
}
