import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DavetProLink } from "@/components/venue-editor/davetpro-link";
import { getDavetProStatus } from "@/lib/services/owner";

export const metadata: Metadata = {
  title: "Entegrasyon",
  robots: { index: false, follow: false },
};

export default async function EntegrasyonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const durum = await getDavetProStatus(id);
  if (!durum) notFound();

  return (
    <section>
      <h2 className="mb-1 font-heading text-xl">Entegrasyon</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Teklif taleplerini başka bir sistemde takip etmek isterseniz.
      </p>
      <DavetProLink venueId={id} durum={durum} />
    </section>
  );
}
