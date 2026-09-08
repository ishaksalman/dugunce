import { requireRole } from "@/lib/auth/session";
import { getMyVenues } from "@/lib/services/owner";
import { PanelShell } from "@/components/panel/panel-shell";
import type { NavItem } from "@/components/panel/panel-nav";

export default async function PanelLayout({ children }: LayoutProps<"/">) {
  // Yetki burada da kontrol ediliyor: middleware yalnızca oturum arıyor,
  // rol kontrolü yapmıyor. Asıl kapı yine RLS.
  const user = await requireRole(["venue_owner", "admin"], "/panel");
  const venues = await getMyVenues();

  const bekleyenTalep = venues.reduce((n, v) => n + Number(v.new_inquiries), 0);

  const items: NavItem[] = [
    { href: "/panel", label: "Panel", icon: "panel" },
    { href: "/panel/mekanlarim", label: "Mekanlarım", icon: "mekan" },
    { href: "/panel/talepler", label: "Teklif Talepleri", icon: "talep", badge: bekleyenTalep },
    { href: "/panel/ayarlar", label: "Ayarlar", icon: "ayar" },
  ];

  return (
    <PanelShell items={items} userName={user.fullName} userEmail={user.email}>
      {children}
    </PanelShell>
  );
}
