import Link from "next/link";
import { Heart, Menu, Search } from "lucide-react";
import { ButtonLink } from "@/components/shared/button-link";
import { SITE } from "@/lib/constants";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2" aria-label={`${SITE.name} ana sayfa`}>
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <span className="font-heading text-base leading-none">D</span>
          </span>
          <span className="font-heading text-lg tracking-tight">{SITE.name}</span>
        </Link>

        <nav aria-label="Ana menü" className="ml-6 hidden items-center gap-1 md:flex">
          <HeaderLink href="/mekanlar">Mekanlar</HeaderLink>
          <HeaderLink href="/dugun-mekanlari">Düğün</HeaderLink>
          <HeaderLink href="/nisan-mekanlari">Nişan</HeaderLink>
          <HeaderLink href="/kina-mekanlari">Kına</HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ButtonLink
            href="/mekanlar"
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            aria-label="Mekan ara"
          >
            <Search />
          </ButtonLink>
          <ButtonLink href="/favorilerim" variant="ghost" size="icon-lg" aria-label="Favorilerim">
            <Heart />
          </ButtonLink>
          <ButtonLink
            href="/kayit?tur=mekan-sahibi"
            variant="outline"
            size="lg"
            className="hidden sm:inline-flex"
          >
            Mekanını Ekle
          </ButtonLink>
          <ButtonLink
            href="/mekanlar"
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            aria-label="Menü"
          >
            <Menu />
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}
