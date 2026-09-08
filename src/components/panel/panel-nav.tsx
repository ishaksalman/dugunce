"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, Inbox, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: "panel" | "mekan" | "talep" | "ayar";
  badge?: number;
}

const ICONS = {
  panel: BarChart3,
  mekan: Building2,
  talep: Inbox,
  ayar: Settings,
} as const;

export function PanelNav({
  items,
  onNavigate,
}: {
  items: NavItem[];
  /** Mobil menüde bağlantıya tıklanınca paneli kapatmak için. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Panel menüsü">
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          // `/panel` her şeyin ön eki; yalnızca tam eşleşmede aktif sayılmalı.
          const active =
            item.href === "/panel"
              ? pathname === "/panel"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="tabular grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground">
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
