import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BlogPostForm } from "@/components/admin/blog-post-form";

export const metadata: Metadata = {
  title: "Yeni rehber yazısı",
  robots: { index: false, follow: false },
};

export default function AdminNewBlogPostPage() {
  return (
    <div className="px-4 py-8 sm:px-8 lg:py-10">
      <Link
        href="/yonetim/rehber"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Rehber
      </Link>

      <header className="mb-6 max-w-3xl">
        <h1 className="font-heading text-2xl sm:text-3xl">Yeni rehber yazısı</h1>
      </header>

      <BlogPostForm />
    </div>
  );
}
