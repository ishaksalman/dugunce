"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2, LayoutDashboard, LogOut, Menu, MessageSquare, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";

const ICONS = {
  panel: LayoutDashboard,
  mekan: Building2,
  kullanici: Users,
  yorum: MessageSquare,
} as const;

export interface AdminNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

export function AdminShell({
  items,
  userName,
  children,
}: {
  items: AdminNavItem[];
  userName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
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
        <span className="font-heading text-lg">Yönetim</span>
      </header>

      {open ? (
        <div className="border-b px-4 py-4 lg:hidden">
          <Nav items={items} onNavigate={() => setOpen(false)} />
        </div>
      ) : null}

      <aside className="hidden w-60 shrink-0 border-r bg-brand-950 text-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Link href="/" className="font-heading text-base tracking-tight">
            {SITE.name}
          </Link>
          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
            Yönetim
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <Nav items={items} dark />
        </div>
        <div className="border-t border-white/10 p-4">
          <p className="mb-3 truncate text-sm text-white/70">{userName}</p>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-9 w-full gap-2 text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-3.5" aria-hidden />
              Çıkış yap
            </Button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-muted/25">{children}</main>
    </div>
  );
}

function Nav({
  items,
  dark,
  onNavigate,
}: {
  items: AdminNavItem[];
  dark?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Yönetim menüsü">
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active =
            item.href === "/yonetim"
              ? pathname === "/yonetim"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  dark
                    ? active
                      ? "bg-white/15 font-medium text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                    : active
                      ? "bg-secondary font-medium text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span
                    className={cn(
                      "tabular grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[11px]",
                      dark ? "bg-sage-300 text-brand-950" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
