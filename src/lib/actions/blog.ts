"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import {
  actionError, actionOk, invalidInput, unexpectedError, type ActionResult,
} from "@/lib/errors";

const BLOG_STATUS = ["DRAFT", "PUBLISHED"] as const;

const blogSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Yalnızca küçük harf, rakam ve tire kullanın."),
  title: z.string().trim().min(3, "En az 3 karakter.").max(200),
  excerpt: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
  contentMd: z.string().trim().min(1, "İçerik boş olamaz."),
  coverImageUrl: z.union([z.literal(""), z.string().trim().url().max(500)])
    .optional().transform((v) => (v ? v : null)),
  status: z.enum(BLOG_STATUS),
});

/** Yeni yazı açar ya da mevcut yazıyı günceller — `id` varsa günceller. */
export async function saveBlogPost(input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = blogSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    const sonuc = await db.adminUpsertBlogPost(parsed.data);

    revalidatePath("/yonetim/rehber");
    revalidatePath("/rehber");
    revalidatePath(`/rehber/${sonuc.slug}`);

    return actionOk(sonuc);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("duplicate key") && error.message.includes("slug")) {
        return actionError("Bu adres (slug) başka bir yazıda kullanılıyor.", {
          slug: "Bu adres zaten kullanılıyor.",
        });
      }
      return actionError(error.message);
    }
    return unexpectedError("saveBlogPost", error);
  }
}

export async function deleteBlogPost(id: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return actionError("Geçersiz yazı.");
  try {
    await requireRole(["admin"]);
    const db = await getDataSource();
    await db.adminDeleteBlogPost(parsed.data);
    revalidatePath("/yonetim/rehber");
    revalidatePath("/rehber");
    return actionOk();
  } catch (error) {
    if (error instanceof Error) return actionError(error.message);
    return unexpectedError("deleteBlogPost", error);
  }
}
