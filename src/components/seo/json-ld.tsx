/**
 * Structured data. `JSON.stringify` çıktısındaki `<` kaçırılıyor —
 * veri içindeki `</script>` dizisi etiketi erkenden kapatabilir.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
