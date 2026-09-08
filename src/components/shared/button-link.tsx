import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Buton görünümlü bağlantı.
 *
 * Base UI'ın `Button`'ı varsayılan olarak native `<button>` bekliyor;
 * `render` ile `<a>` verildiğinde `nativeButton={false}` gerekiyor, aksi
 * hâlde erişilebilirlik uyarısı veriyor. Bu bileşen o ayrıntıyı tek yerde
 * tutuyor — çağrı yerlerinde tekrar etmiyoruz.
 */
export function ButtonLink({
  href,
  children,
  variant,
  size,
  className,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "render" | "nativeButton" | "children">) {
  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      className={className}
      nativeButton={false}
      render={<Link href={href}>{children}</Link>}
    />
  );
}
