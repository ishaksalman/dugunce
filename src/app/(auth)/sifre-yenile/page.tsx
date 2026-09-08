import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/reset-forms";

export const metadata: Metadata = {
  title: "Yeni Parola Belirle",
  robots: { index: false, follow: false },
};

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
