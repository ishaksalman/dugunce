import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { SITE, DESTEK_EPOSTA } from "@/lib/constants";

export const metadata: Metadata = {
  title: "İletişim",
  description: `${SITE.name} ile iletişime geçin. Mekan sahipleri, kullanıcılar ve iş birlikleri için.`,
  alternates: { canonical: "/iletisim" },
};

export default function IletisimPage() {
  return (
    <>
      <h1>İletişim</h1>
      <p>
        Sorularınız, önerileriniz ve iş birliği talepleriniz için bize
        yazabilirsiniz. Genellikle bir iş günü içinde dönüş yapıyoruz.
      </p>

      <p>
        <a href={`mailto:${DESTEK_EPOSTA}`} className="inline-flex items-center gap-2">
          <Mail className="size-4" aria-hidden />
          {DESTEK_EPOSTA}
        </a>
      </p>

      <h2>Mekanınızı listelemek istiyorsanız</h2>
      <p>
        Bize yazmanıza gerek yok — hesabınızı açıp mekanınızı kendiniz
        ekleyebilirsiniz. Listeleme ücretsizdir.
      </p>
      <p>
        <Link href="/kayit?tur=mekan-sahibi">Mekan sahibi kaydı →</Link>
      </p>

      <h2>Bir mekan hakkında sorununuz varsa</h2>
      <p>
        Yanlış bilgi, gerçeği yansıtmayan fotoğraf veya ulaşılamayan bir mekanla
        karşılaştıysanız bize bildirin. Mekanın adını ve sorunu yazmanız
        yeterli; inceleyip gerekirse yayından kaldırıyoruz.
      </p>

      <h2>Kişisel verilerinizle ilgili talepler</h2>
      <p>
        KVKK kapsamındaki başvurularınızı da yukarıdaki adrese
        iletebilirsiniz. Ayrıntılar için{" "}
        <Link href="/gizlilik">gizlilik politikamıza</Link> bakın.
      </p>
    </>
  );
}
