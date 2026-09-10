import { requireRole } from "@/lib/auth/session";
import { getAdminStats } from "@/lib/services/admin";
import { AdminShell, type AdminNavItem } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  // Yetkisiz kullanıcı 404 görür (requireRole → notFound): "burada bir
  // yönetim paneli var ama giremezsin" demek gereksiz bilgi.
  const user = await requireRole(["admin"], "/yonetim");
  const stats = await getAdminStats();

  const items: AdminNavItem[] = [
    { href: "/yonetim", label: "Özet", icon: "panel" },
    {
      href: "/yonetim/mekanlar",
      label: "Mekanlar",
      icon: "mekan",
      badge: Number(stats.pending_venues) + Number(stats.needs_review),
    },
    { href: "/yonetim/kullanicilar", label: "Kullanıcılar", icon: "kullanici" },
    { href: "/yonetim/seo", label: "SEO Sayfaları", icon: "seo" },
    {
      href: "/yonetim/yorumlar",
      label: "Yorumlar",
      icon: "yorum",
      badge: Number(stats.pending_reviews),
    },
  ];

  return (
    <AdminShell items={items} userName={user.fullName}>
      {children}
    </AdminShell>
  );
}
