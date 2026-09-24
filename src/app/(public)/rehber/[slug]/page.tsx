import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { getBlogPost, listBlogPostSlugs } from "@/lib/services/blog";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/constants";

// Landing sayfaları ve mekan detayı gibi bu da ISR ile statik üretiliyor;
// `generateStaticParams` OLMADAN prerender-manifest'e girmiyor (bkz.
// CLAUDE.md). Yeni bir yazı build'den sonra yayınlanırsa ilk istekte
// üretilip önbelleğe alınır (dynamicParams varsayılanı).
export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await listBlogPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

type Params = { slug: string };

export async function generateMetadata(
  { params }: PageProps<"/rehber/[slug]">,
): Promise<Metadata> {
  const { slug } = (await params) as Params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Yazı bulunamadı" };

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/rehber/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt ?? undefined,
      url: new URL(`/rehber/${post.slug}`, SITE.url).toString(),
      images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined,
    },
  };
}

export default async function BlogPostPage(
  { params }: PageProps<"/rehber/[slug]">,
) {
  const { slug } = (await params) as Params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const path = `/rehber/${post.slug}`;
  const html = renderMarkdown(post.content_md);

  const breadcrumbs = [
    { name: "Ana sayfa", path: "/" },
    { name: "Rehber", path: "/rehber" },
    { name: post.title, path },
  ];

  return (
    <>
      <JsonLd data={blogPostingJsonLd(post, path)} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />

      <div className="container-page py-8 lg:py-12">
        <nav aria-label="Sayfa yolu" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((item, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <li key={item.path} className="flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="size-3.5 shrink-0" aria-hidden /> : null}
                  {last ? (
                    <span aria-current="page" className="truncate text-foreground">
                      {item.name}
                    </span>
                  ) : (
                    <Link href={item.path} className="transition-colors hover:text-foreground">
                      {item.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <article className="mx-auto max-w-[68ch]">
          <header>
            {post.published_at ? (
              <p className="text-sm text-muted-foreground">{formatDate(post.published_at)}</p>
            ) : null}
            <h1 className="mt-2 font-heading text-3xl leading-tight sm:text-4xl">
              {post.title}
            </h1>
            {post.excerpt ? (
              <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
            ) : null}
          </header>

          {post.cover_image_url ? (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl bg-muted">
              <Image
                src={post.cover_image_url}
                alt=""
                fill
                sizes="(min-width: 1024px) 780px, 100vw"
                priority
                className="object-cover"
              />
            </div>
          ) : null}

          {/* Markdown yalnızca admin tarafından yazılıyor — güven sınırı
              admin'in zaten veritabanına yazma yetkisiyle aynı (bkz.
              lib/markdown.ts). `.icerik` sınıfı hakkımızda/gizlilik
              sayfalarıyla aynı tipografiyi veriyor. */}
          <div
            className="icerik mt-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>
      </div>
    </>
  );
}
