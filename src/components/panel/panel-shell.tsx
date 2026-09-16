"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelNav, type NavItem } from "./panel-nav";
import { signOut } from "@/lib/actions/auth";
import { Wordmark } from "@/components/shared/wordmark";
import { SITE } from "@/lib/constants";

/**
 * Panel kabuğu: masaüstünde sabit kenar menü, mobilde açılır panel.
 * Menü verisi sunucudan geliyor (rozet sayıları dahil), burada yalnızca
 * açılıp kapanma durumu tutuluyor.
 */
export function PanelShell({
  items,
  userName,
  userEmail,
  children,
}: {
  items: NavItem[];
  userName: string;
  userEmail: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* --- Mobil üst bar --- */}
      <header className="flex items-center gap-2 border-b px-4 py-3 lg:hidden">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </Button>
        <Link href="/panel" aria-label={`${SITE.name} paneli`}>
          <Wordmark className="h-5 w-auto text-foreground" />
        </Link>
      </header>

      {open ? (
        <div className="border-b px-4 py-4 lg:hidden">
          <PanelNav items={items} onNavigate={() => setOpen(false)} />
          <div className="mt-4 border-t pt-4">
            <UserBlock name={userName} email={userEmail} />
          </div>
        </div>
      ) : null}

      {/* --- Masaüstü kenar menü --- */}
      <aside className="hidden w-64 shrink-0 border-r lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b px-5">
          <Link href="/" className="flex items-center" aria-label={`${SITE.name} ana sayfa`}>
            <Wordmark className="h-5 w-auto text-foreground" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <PanelNav items={items} />
        </div>
        <div className="border-t p-4">
          <UserBlock name={userName} email={userEmail} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-muted/25">{children}</main>
    </div>
  );
}

function UserBlock({ name, email }: { name: string; email: string | null }) {
  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        {email ? (
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        ) : null}
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm" className="h-9 w-full gap-2">
          <LogOut className="size-3.5" aria-hidden />
          Çıkış yap
        </Button>
      </form>
    </div>
  );
}
