import type { Metadata } from "next";
import { FavoritesList } from "@/components/venue/favorites-list";

export const metadata: Metadata = {
  title: "Favorilerim",
  description: "Beğendiğin davet mekanlarını karşılaştır.",
  // Kişiye özel liste; indekslenecek içerik yok.
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return (
    <div className="container-page py-10 lg:py-14">
      <header className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl">Favorilerim</h1>
        <p className="mt-2 text-muted-foreground">
          Beğendiğin mekanlar bu tarayıcıda saklanır — üyelik gerekmez.
        </p>
      </header>
      <FavoritesList />
    </div>
  );
}
