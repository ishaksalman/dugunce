import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "./button-link";
import { SearchX, TriangleAlert } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      <SearchX className="mb-4 size-8 text-muted-foreground" aria-hidden />
      <h3 className="text-lg font-medium">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <ButtonLink href={action.href} variant="outline" size="lg" className="mt-6">
          {action.label}
        </ButtonLink>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = "Bir şeyler ters gitti",
  description = "Mekanlar yüklenirken bir hata oluştu. Lütfen tekrar deneyin.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center"
    >
      <TriangleAlert className="mb-4 size-8 text-destructive" aria-hidden />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          Tekrar dene
        </Button>
      ) : null}
    </div>
  );
}
