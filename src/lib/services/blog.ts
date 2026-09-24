import "server-only";
import { cache } from "react";
import { getDataSource } from "@/lib/db";

export const getBlogPost = cache(async (slug: string) => {
  const db = await getDataSource();
  return db.getBlogPost(slug);
});

export const listBlogPosts = cache(async (limit = 20, offset = 0) => {
  const db = await getDataSource();
  return db.listBlogPosts(limit, offset);
});

export const listBlogPostSlugs = cache(async () => {
  const db = await getDataSource();
  return db.listBlogPostSlugs();
});
