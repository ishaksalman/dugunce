import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ButtonLink } from "@/components/shared/button-link";
import { HeroSearch } from "@/components/search/hero-search";
import { VenueCard, VenueGrid } from "@/components/venue/venue-card";
import { Icon } from "@/components/shared/icon";
import { getCities, getEventTypes } from "@/lib/services/taxonomy";
import { getFeaturedVenues } from "@/lib/services/venues";
import { formatNumber } from "@/lib/format";
import { SITE } from "@/lib/constants";
import type { Metadata } from "next";
import { landingHref, landingPath } from "@/lib/seo/paths";

// Ana sayfa saatte bir tazeleniyor; içerik nadiren değişiyor ve LCP kritik.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Düğün, Nişan ve Kına Mekanları — Hayalindeki Davet Mekanını Bul",
  description: SITE.description,
  alternates: { canonical: "/" },
};

const HERO_IMAGE =
  "https://picsum.photos/seed/dugunce-hero/2400/1400";

export default async function HomePage() {
  const [cities, eventTypes, featured] = await Promise.all([
    getCities(),
    getEventTypes(),
    getFeaturedVenues(6),
  ]);

  const popularCities = cities.filter((c) => c.is_popular);

  return (
    <>
      {/* --- Hero -------------------------------------------------------- */}
      <section className="relative">
        <div className="absolute inset-0 -z-10">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-brand-950/65" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="container-page pb-10 pt-20 sm:pt-28 lg:pb-16 lg:pt-36">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-sage-200">
              Türkiye&apos;nin davet mekanı rehberi
            </p>
            <h1 className="mt-4 text-4xl leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              Hayalindeki Davet Mekanını Bul
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/80">
              Düğün, nişan, kına ve tüm özel günlerin için en güzel mekanları keşfet.
            </p>
          </div>

          <div className="mt-10 max-w-4xl">
            <HeroSearch cities={cities} eventTypes={eventTypes} />
          </div>

          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/75">
            <Stat icon={<Sparkles className="size-4" aria-hidden />}>
              {formatNumber(cities.reduce((n, c) => n + c.venue_count, 0))} mekan
            </Stat>
            <Stat icon={<Users className="size-4" aria-hidden />}>
              {eventTypes.length} etkinlik türü
            </Stat>
            <Stat icon={<ShieldCheck className="size-4" aria-hidden />}>
              Doğrulanmış işletmeler
            </Stat>
          </dl>
        </div>
      </section>

      {/* --- Etkinlik türleri --------------------------------------------- */}
      <section className="container-page pt-14">
        <SectionHead
          title="Ne için mekan arıyorsun?"
          description="Etkinlik türüne göre başlayarak aramayı daralt."
        />
        <ul className="mt-6 flex flex-wrap gap-2">
          {eventTypes.map((e) => (
            <li key={e.id}>
              <Link
                href={landingHref(landingPath({ eventSlug: e.slug }))}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-colors hover:border-primary hover:bg-secondary"
              >
                <Icon name={e.icon} className="size-4 text-muted-foreground" />
                {e.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Popüler şehirler --------------------------------------------- */}
      <section className="container-page pt-16">
        <SectionHead
          title="Popüler şehirler"
          description="En çok mekan bulunan şehirlerden başla."
          action={{ label: "Tüm mekanlar", href: "/mekanlar" }}
        />
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {popularCities.map((c) => (
            <li key={c.id}>
              <Link
                href={landingHref(landingPath({ citySlug: c.slug, eventSlug: "dugun" }))}
                className="group relative block overflow-hidden rounded-xl"
              >
                <div className="relative aspect-[4/5]">
                  <Image
                    src={`https://picsum.photos/seed/dugunce-sehir-${c.slug}/600/750`}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 200px, 45vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-950/85 via-brand-950/20 to-transparent" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="font-heading text-base text-white">{c.name}</p>
                  <p className="tabular text-xs text-white/70">
                    {c.venue_count > 0 ? `${formatNumber(c.venue_count)} mekan` : "Yakında"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Öne çıkan mekanlar ------------------------------------------- */}
      <section className="container-page pt-16">
        <SectionHead
          title="Öne çıkan mekanlar"
          description="Editör seçkisi ve en çok ilgi gören davet mekanları."
          action={{ label: "Hepsini gör", href: "/mekanlar" }}
        />
        <div className="mt-6">
          <VenueGrid>
            {featured.map((v, i) => (
              <VenueCard key={v.id} venue={v} priority={i < 3} />
            ))}
          </VenueGrid>
        </div>
      </section>

      {/* --- Mekan sahibi CTA --------------------------------------------- */}
      <section className="container-page pt-20">
        <div className="overflow-hidden rounded-2xl bg-primary text-primary-foreground">
          <div className="flex flex-col gap-6 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-heading text-2xl sm:text-3xl">
                Mekanının sahibi misin?
              </h2>
              <p className="mt-3 text-primary-foreground/75">
                Mekanını ücretsiz listele, teklif taleplerini doğrudan al.
                Kurulum ücreti yok, komisyon yok.
              </p>
            </div>
            <ButtonLink
              href="/kayit?tur=mekan-sahibi"
              size="lg"
              variant="secondary"
              className="h-12 shrink-0 gap-2 px-6"
            >
              Mekanını Ücretsiz Ekle
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h2 className="font-heading text-2xl sm:text-3xl">{title}</h2>
        {description ? (
          <p className="mt-2 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex"
        >
          {action.label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function Stat({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="tabular">{children}</span>
    </div>
  );
}
