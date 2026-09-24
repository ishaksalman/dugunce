import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listBlogPosts } from "@/lib/services/blog";
import { EmptyState } from "@/components/shared/states";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/constants";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Rehber",
  description:
    "Düğün, nişan ve kına planlarken işine yarayacak öneriler, bütçe ve mekan seçim rehberleri.",
  alternates: { canonical: "/rehber" },
};

export default async function BlogIndexPage() {
  const { items } = await listBlogPosts(50);

  return (
    <div className="container-page py-10 lg:py-16">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {SITE.name}
        </p>
        <h1 className="mt-2 font-heading text-3xl sm:text-4xl">Rehber</h1>
        <p className="mt-3 text-muted-foreground">
          Düğün, nişan ve kına planlarken işine yarayacak öneriler, bütçe ve
          mekan seçim rehberleri.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Henüz yazı yok"
            description="Yakında burada düğün planlamaya dair rehberler olacak."
          />
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((post) => (
            <li key={post.id}>
              <Link href={`/rehber/${post.slug}`} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
                  {post.cover_image_url ? (
                    <Image
                      src={post.cover_image_url}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-sm text-muted-foreground">
                      {SITE.name}
                    </div>
                  )}
                </div>
                <div className="pt-3">
                  {post.published_at ? (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(post.published_at)}
                    </p>
                  ) : null}
                  <h2 className="mt-1 font-heading text-lg leading-snug transition-colors group-hover:text-primary">
                    {post.title}
                  </h2>
                  {post.excerpt ? (
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {post.excerpt}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
