import Link from "next/link";
import { SITE } from "@/lib/constants";
import { getCities, getEventTypes } from "@/lib/services/taxonomy";

export async function Footer() {
  const [cities, eventTypes] = await Promise.all([getCities(true), getEventTypes()]);

  return (
    <footer className="mt-24 border-t bg-muted/40">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-heading text-base leading-none">D</span>
            </span>
            <span className="font-heading text-lg tracking-tight">{SITE.name}</span>
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            Düğün, nişan, kına ve tüm özel günlerin için Türkiye&apos;nin davet
            mekanlarını tek yerde keşfet.
          </p>
        </div>

        <FooterColumn title="Popüler Şehirler">
          {cities.slice(0, 8).map((c) => (
            <FooterLink key={c.id} href={`/${c.slug}-dugun-mekanlari`}>
              {c.name} Düğün Mekanları
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Etkinlik Türleri">
          {eventTypes.slice(0, 8).map((e) => (
            <FooterLink key={e.id} href={`/${e.slug}-mekanlari`}>
              {e.seo_noun} Mekanları
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Kurumsal">
          <FooterLink href="/mekan-ekle">Mekanını Ekle</FooterLink>
          <FooterLink href="/hakkimizda">Hakkımızda</FooterLink>
          <FooterLink href="/iletisim">İletişim</FooterLink>
          <FooterLink href="/gizlilik">Gizlilik Politikası</FooterLink>
          <FooterLink href="/kullanim-kosullari">Kullanım Koşulları</FooterLink>
        </FooterColumn>
      </div>

      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.name}. Tüm hakları saklıdır.</p>
          <p>Türkiye&apos;nin davet mekanı rehberi</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {children}
      </Link>
    </li>
  );
}
