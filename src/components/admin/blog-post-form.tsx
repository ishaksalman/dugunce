"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaxField, taxInput } from "./taxonomy-row";
import { saveBlogPost, deleteBlogPost } from "@/lib/actions/blog";
import { slugifyTr } from "@/lib/slug";
import type { AdminBlogPostDetail } from "@/types/db";

const DURUM_ETIKET: Record<string, string> = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayında",
};

/**
 * Rehber yazısı formu — hem yeni açma hem düzenleme için tek bileşen.
 *
 * İçerik markdown (bkz. lib/markdown.ts): zengin metin editörü yerine düz
 * bir textarea — bu boyuttaki bir özellik için ekstra bağımlılık gerekmedi.
 *
 * Slug yalnızca YENİ yazıda ve TASLAKKEN başlıkla birlikte otomatik dolar;
 * admin elle değiştirdiği anda otomatik takip durur (aynı venue wizard'daki
 * slug/isim ilişkisi). Yayındaki bir yazının slug'ı sunucu tarafında zaten
 * sabitleniyor (bkz. admin_upsert_blog_post, 0049).
 */
export function BlogPostForm({ post }: { post?: AdminBlogPostDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const slugLocked = post?.status === "PUBLISHED";

  return (
    <form
      noValidate
      className="max-w-3xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setErrors({});
        setFormError(null);
        startTransition(async () => {
          const r = await saveBlogPost({ ...data, id: post?.id, slug });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            setFormError(r.message);
            return;
          }
          toast.success(post ? "Yazı güncellendi" : "Yazı oluşturuldu");
          if (!post) router.push(`/yonetim/rehber/${r.data.id}`);
          else router.refresh();
        });
      }}
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <TaxField label="Başlık" error={errors.title}>
        <input
          name="title"
          autoFocus
          maxLength={200}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugifyTr(e.target.value));
          }}
          className={taxInput}
        />
      </TaxField>

      <TaxField
        label="Adres (slug)"
        error={errors.slug}
        hint={
          slugLocked
            ? "Yayındaki yazının adresi değiştirilemez — gelen bağlantıları kırar."
            : "/rehber/" + (slug || "…")
        }
      >
        <input
          name="slug"
          value={slug}
          disabled={slugLocked}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className={taxInput + (slugLocked ? " opacity-60" : "")}
        />
      </TaxField>

      <TaxField label="Özet" error={errors.excerpt} hint="İsteğe bağlı — kart ve meta açıklamada kullanılır, en fazla 300 karakter.">
        <textarea
          name="excerpt"
          rows={2}
          maxLength={300}
          defaultValue={post?.excerpt ?? ""}
          className={taxInput + " h-auto py-2"}
        />
      </TaxField>

      <TaxField label="Kapak görseli" error={errors.coverImageUrl} hint="İsteğe bağlı — tam görsel adresi">
        <input
          name="coverImageUrl"
          type="url"
          maxLength={500}
          defaultValue={post?.cover_image_url ?? ""}
          className={taxInput}
        />
      </TaxField>

      <TaxField label="İçerik (Markdown)" error={errors.contentMd}>
        <textarea
          name="contentMd"
          rows={16}
          defaultValue={post?.content_md ?? ""}
          placeholder={"## Alt başlık\n\nParagraf metni. **Kalın**, *italik*, [bağlantı](https://ornek.com).\n\n- Madde\n- Madde"}
          className={taxInput + " h-auto py-2 font-mono text-sm leading-relaxed"}
        />
      </TaxField>

      <TaxField label="Durum" error={errors.status}>
        <select name="status" defaultValue={post?.status ?? "DRAFT"} className={taxInput}>
          {Object.entries(DURUM_ETIKET).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </TaxField>

      <div className="flex items-center gap-3 border-t pt-5">
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? "Kaydediliyor…" : post ? "Kaydet" : "Yazıyı oluştur"}
        </Button>
        {post ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 text-destructive hover:bg-destructive/5"
            disabled={pending}
            onClick={() => {
              if (!confirm(`"${post.title}" silinsin mi? Bu işlem geri alınamaz.`)) return;
              startTransition(async () => {
                const r = await deleteBlogPost(post.id);
                if (!r.ok) {
                  toast.error(r.message);
                  return;
                }
                toast.success("Yazı silindi");
                router.push("/yonetim/rehber");
              });
            }}
          >
            Sil
          </Button>
        ) : null}
      </div>
    </form>
  );
}
