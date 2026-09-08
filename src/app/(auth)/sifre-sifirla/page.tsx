import type { Metadata } from "next";
import { ResetRequestForm } from "@/components/auth/reset-forms";

export const metadata: Metadata = {
  title: "Parolamı Unuttum",
  robots: { index: false, follow: false },
};

export default function ResetRequestPage() {
  return <ResetRequestForm />;
}
