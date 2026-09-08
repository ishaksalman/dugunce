"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { VENUE_STEPS } from "@/lib/schemas/venue";

/**
 * Adım gezinmesi. Zorunlu sıra YOK — kullanıcı istediği adıma atlayabilir.
 * Tamamlanma işareti, o adımın verisinin girilip girilmediğini gösterir.
 */
export function StepNav({
  venueId,
  completed,
}: {
  venueId: string;
  completed: Record<string, boolean>;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Düzenleme adımları">
      <ol className="space-y-1">
        {VENUE_STEPS.map((step, i) => {
          const href = `/panel/mekanlarim/${venueId}/${step.slug}`;
          const active = pathname === href;
          const done = completed[step.slug];
          return (
            <li key={step.slug}>
              <Link
                href={href}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "tabular grid size-6 shrink-0 place-items-center rounded-full border text-xs",
                    done
                      ? "border-success bg-success text-success-foreground"
                      : active
                        ? "border-primary text-primary"
                        : "border-border",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                <span className="flex-1">{step.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
