import { redirect } from "next/navigation";

/** Adımsız adres ilk adıma yönlendirir. */
export default async function VenueEditorIndex({
  params,
}: PageProps<"/panel/mekanlarim/[id]">) {
  const { id } = await params;
  redirect(`/panel/mekanlarim/${id}/temel-bilgiler`);
}
