"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Navbar'daki mekan arama kutusu.
 *
 * Kendi başına sorgu çalıştırmaz; `/mekanlar?q=...`'a gönderir — arama
 * sonucu paylaşılabilir kalır (bkz. hero-search.tsx, aynı desen).
 *
 * Masaüstünde her zaman görünür, dar bir kutu. Mobilde yer olmadığı için
 * ikon tıklanınca üst satırın TAMAMI arama kutusuna dönüşüyor — bu yüzden
 * `<Header>` içindeki `<header>` elemanı `relative` olmalı (bkz. header.tsx).
 */
export function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/mekanlar?q=${encodeURIComponent(query)}` : "/mekanlar");
    setMobileOpen(false);
  };

  return (
    <>
      <form
        onSubmit={submit}
        role="search"
        aria-label="Mekan ara"
        className="relative hidden md:block"
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Mekan adı ara…"
          className="h-10 w-48 rounded-full border bg-background pl-9 pr-3 text-sm outline-none transition-[width] focus:w-64 focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
        />
      </form>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Mekan ara"
        className="grid size-11 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-muted md:hidden"
      >
        <Search className="size-5" aria-hidden />
      </button>

      {mobileOpen ? (
        <form
          onSubmit={submit}
          role="search"
          aria-label="Mekan ara"
          className="absolute inset-x-0 top-0 z-40 flex h-16 items-center gap-2 border-b bg-background px-4 md:hidden"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mekan adı ara…"
            className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Aramayı kapat"
            className="shrink-0 p-2 text-muted-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </form>
      ) : null}
    </>
  );
}
