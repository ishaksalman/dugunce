import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/**
 * Oturum tazeleme.
 *
 * Supabase erişim jetonu kısa ömürlü; sunucu bileşenleri çerez yazamadığı
 * için tazeleme middleware'de yapılmak zorunda. Aksi hâlde kullanıcı bir
 * saat sonra sessizce çıkış yapmış oluyor.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          for (const { name, value } of items) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of items) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getUser()` çağrısı ŞART: jetonu sunucuda doğrulayıp tazeliyor.
  // `getSession()` çerezdeki veriyi doğrulamadan okur, güvenilmez.
  const { data } = await supabase.auth.getUser();

  return { response, user: data.user };
}
