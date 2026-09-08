import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BasicsStep } from "@/components/venue-editor/steps/basics-step";
import { LocationStep } from "@/components/venue-editor/steps/location-step";
import { CapacityStep } from "@/components/venue-editor/steps/capacity-step";
import { ServicesStep } from "@/components/venue-editor/steps/services-step";
import { PricingStep } from "@/components/venue-editor/steps/pricing-step";
import { PhotosStep } from "@/components/venue-editor/steps/photos-step";
import { DescriptionStep } from "@/components/venue-editor/steps/description-step";
import { PreviewStep } from "@/components/venue-editor/steps/preview-step";
import { getVenueForEdit } from "@/lib/services/owner";
import {
  getCities, getEventTypes, getFeatures, getVenueTypes,
} from "@/lib/services/taxonomy";
import { VENUE_STEPS, isVenueStep } from "@/lib/schemas/venue";

export const metadata: Metadata = {
  title: "Mekan Düzenle",
  robots: { index: false, follow: false },
};

export default async function VenueEditorStep({
  params,
}: PageProps<"/panel/mekanlarim/[id]/[adim]">) {
  const { id, adim } = await params;
  if (!isVenueStep(adim)) notFound();

  const venue = await getVenueForEdit(id);
  if (!venue) notFound();

  const step = VENUE_STEPS.find((s) => s.slug === adim)!;

  return (
    <section>
      <h2 className="mb-1 font-heading text-xl">{step.label}</h2>
      <p className="mb-6 text-sm text-muted-foreground">{ACIKLAMA[adim]}</p>
      {await renderStep(adim, venue)}
    </section>
  );
}

const ACIKLAMA: Record<string, string> = {
  "temel-bilgiler": "Mekanınızın adı, türü ve iletişim bilgileri.",
  konum: "Şehir, ilçe ve harita konumu. Konum, aramada bulunabilmeniz için önemli.",
  kapasite: "Kaç kişilik organizasyonlara ev sahipliği yapabiliyorsunuz?",
  hizmetler: "Sunduğunuz imkanlar ve hizmetler. Filtrelerde bunlarla bulunuyorsunuz.",
  fiyatlandirma: "Başlangıç fiyatınız. Kesin fiyat teklif aşamasında konuşulur.",
  fotograflar: "En az 5 fotoğraf ekleyin. İlk fotoğraf kapak olarak kullanılır.",
  aciklama: "Mekanınızı anlatın. En az 200 karakter yazmanız önerilir.",
  onizleme: "Her şey hazırsa yayına gönderin.",
};

async function renderStep(
  adim: string,
  venue: NonNullable<Awaited<ReturnType<typeof getVenueForEdit>>>,
) {
  switch (adim) {
    case "temel-bilgiler": {
      const venueTypes = await getVenueTypes();
      return <BasicsStep venue={venue} venueTypes={venueTypes} />;
    }
    case "konum": {
      const cities = await getCities();
      return <LocationStep venue={venue} cities={cities} />;
    }
    case "kapasite":
      return <CapacityStep venue={venue} />;
    case "hizmetler": {
      const [features, eventTypes] = await Promise.all([getFeatures(), getEventTypes()]);
      return <ServicesStep venue={venue} features={features} eventTypes={eventTypes} />;
    }
    case "fiyatlandirma":
      return <PricingStep venue={venue} />;
    case "fotograflar":
      return <PhotosStep venue={venue} />;
    case "aciklama":
      return <DescriptionStep venue={venue} />;
    case "onizleme":
      return <PreviewStep venue={venue} />;
    default:
      notFound();
  }
}
