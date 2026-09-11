/**
 * Metin ağırlıklı içerik sayfalarının ortak kabuğu.
 * Okunabilirlik için satır uzunluğu sınırlı (yaklaşık 70 karakter).
 */
export default function IcerikLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="container-page py-10 lg:py-16">
      <article className="icerik mx-auto max-w-[68ch]">{children}</article>
    </div>
  );
}
