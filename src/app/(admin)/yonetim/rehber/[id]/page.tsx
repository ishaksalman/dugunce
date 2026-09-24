import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BlogPostForm } from "@/components/admin/blog-post-form";
import { getAdminBlogPost } from "@/lib/services/admin";

export const metadata: Metadata = {
  title: "Yazıyı düzenle",
  robots: { index: false, follow: false },
};

export default async function AdminEditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getAdminBlogPost(id);
  if (!post) notFound();

  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <Link
        href="/yonetim/rehber"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Rehber
      </Link>

      <header className="mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl sm:text-3xl">{post.title}</h1>
        {post.status === "PUBLISHED" ? (
          <a
            href={`/rehber/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Sayfayı görüntüle
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </header>

      <BlogPostForm post={post} />
    </div>
  );
}
