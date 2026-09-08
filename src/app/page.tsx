/**
 * GEÇİCİ: tasarım token'ları önizlemesi. P2'de gerçek ana sayfa ile değişecek.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const BRAND = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const SAGE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export default function TokenPreview() {
  return (
    <main className="container-page space-y-16 py-16">
      <section className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          İstanbul · Beylikdüzü
        </p>
        <h1 className="max-w-3xl text-5xl leading-[1.05] sm:text-6xl">
          Hayalindeki Davet Mekanını Bul
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Düğün, nişan, kına ve tüm özel günlerin için en güzel mekanları keşfet.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button size="lg">Mekan Ara</Button>
          <Button size="lg" variant="secondary">
            Teklif Al
          </Button>
          <Button size="lg" variant="outline">
            Detayları Gör
          </Button>
          <Badge>Öne Çıkan</Badge>
        </div>
        <div className="max-w-sm pt-2">
          <Input placeholder="Şehir veya ilçe ara…" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Türkçe karakter kontrolü</h2>
        <p className="font-heading text-3xl">
          Çığır açan ışıltılı düğün · İĞÜŞÖÇ ığüşöç · Bilecik Şeyh Edebali
        </p>
        <p className="text-base">
          Inter gövde: Çığır açan ışıltılı düğün · İĞÜŞÖÇ ığüşöç · 1.234.567 ₺
        </p>
        <p className="tabular text-base">
          Tabular sayılar: ₺75.000 · ₺120.000 · 100–500 kişi
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl">Skalalar</h2>
        {[
          { name: "brand", steps: BRAND },
          { name: "sage", steps: SAGE },
        ].map(({ name, steps }) => (
          <div key={name} className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{name}</p>
            <div className="flex flex-wrap gap-1">
              {steps.map((s) => (
                <div key={s} className="w-16 space-y-1">
                  <div
                    className="h-14 rounded-md border"
                    style={{ background: `var(--${name}-${s})` }}
                  />
                  <p className="text-center text-[11px] text-muted-foreground">{s}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Semantik yüzeyler</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["card", "bg-card text-card-foreground"],
            ["muted", "bg-muted text-muted-foreground"],
            ["secondary", "bg-secondary text-secondary-foreground"],
            ["accent", "bg-accent text-accent-foreground"],
            ["primary", "bg-primary text-primary-foreground"],
            ["success", "bg-success text-success-foreground"],
            ["warning", "bg-warning text-warning-foreground"],
            ["destructive", "bg-destructive text-destructive-foreground"],
          ].map(([label, cls]) => (
            <div key={label} className={`rounded-lg border p-5 ${cls}`}>
              <p className="text-sm font-medium">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
