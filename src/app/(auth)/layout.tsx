import Link from "next/link";
import { Wordmark } from "@/components/shared/wordmark";
import { SITE } from "@/lib/constants";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page py-6">
        <Link href="/" className="inline-flex items-center" aria-label={`${SITE.name} ana sayfa`}>
          <Wordmark className="h-6 w-auto text-foreground" />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
