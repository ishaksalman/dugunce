# Düğünce — yapılacaklar

Henüz uygulanmamış, ileride ele alınacak işler. Her madde bağımsız
çalışılabilecek kadar somutlaştırılmış olmalı — "şunu yap" değil, "şunu şu
şekilde yap, çünkü ..." formatında.

## Fiyat — zaman sınırlı indirim

**İstek (kullanıcı):** Fiyatlandırma adımında indirim uygulayabilelim; bir
zaman aralığı (başlangıç–bitiş tarihi) verip doğrudan indirimli fiyatı
girebilelim. Vitrinde eski fiyatın üstü çizili, yanında yeni (indirimli)
fiyat gösterilsin.

**Neden zaman aralığı, tek bir "indirimli fiyat" alanı değil:**
`featured_until` (0043) ile aynı hata bir kez daha yaşanmasın — süresiz
sanılan bir alan sessizce süresiz kalıp kimse fark etmeden aylarca
"indirimde" görünebilir. Süre baştan şema seviyesinde zorunlu olmalı.

### Önerilen şema (yeni migration)

`venues` tablosuna üç kolon:

```sql
alter table public.venues
  add column discount_price numeric(12, 2)
    check (discount_price is null or discount_price >= 0),
  add column discount_starts_at timestamptz,
  add column discount_ends_at   timestamptz
    check (discount_ends_at is null or discount_starts_at is null
           or discount_ends_at > discount_starts_at);
```

- Üçü birlikte dolar ya da üçü de boş kalır — kısmi doluluk (`discount_price`
  var ama tarih yok) `guard_venue_update`'te reddedilmeli. `starting_price`'ın
  kendisi hâlâ "asıl/liste fiyatı"; `discount_price` bunun ÜZERİNE binen,
  zamanla kısıtlı bir görünüm.
- `discount_price`, `starting_price`'tan küçük olmalı — kısıt veya
  `guard_venue_update` içinde kontrol edilmeli. Aksi hâlde "indirim" fiyatı
  artırmış olur.

### Tazelik kararı SQL'de olmalı (0034/0043 ile AYNI desen)

```sql
create or replace function public.venue_discount_active(
  p_discount_price numeric,
  p_starts_at timestamptz,
  p_ends_at   timestamptz
) returns boolean language sql stable as $$
  select p_discount_price is not null
     and (p_starts_at is null or p_starts_at <= now())
     and (p_ends_at   is null or p_ends_at   >  now());
$$;
```

Bileşende `Date.now()` okumak YASAK — sayfa `generateStaticParams` ile
prerender ediliyor (bkz. CLAUDE.md, google puanı tazeliği notu), build
anında donmuş bir karar üretirdi ve React'in saf render kuralını da ihlal
ederdi. `search_venues`, `get_venue_detail`, `get_venues_by_ids` bu
fonksiyonla HESAPLANMIŞ bir `discount_active` alanı döndürmeli — ham
`discount_price`'ı değil.

### Vitrin

- `formatStartingPrice()` (`lib/format.ts`) yeni bir dönüş alanı almalı:
  `original` (üstü çizili) + mevcut `primary` (indirimli, kalın). İndirim
  aktif değilse davranış birebir bugünkü gibi kalmalı — tek bir fiyat.
- `VenueCard` ve mekan detayındaki fiyat bloğu ikisi de güncellenmeli.
- JSON-LD `offers` alanı varsa (kontrol edilmeli, `lib/seo/jsonld.ts`)
  indirimli fiyatı yansıtmalı — Google yapılandırılmış veri, gerçek satış
  fiyatını bekliyor.

### Wizard (`pricing-step.tsx`)

- "İndirim uygula" bir checkbox/toggle; açılınca indirimli fiyat + iki
  tarih alanı görünür. Kapatılınca üç alan da temizlenip gönderilmeli
  ("hepsini kaldır" FormData'da alanın hiç gitmemesiyle karışmasın — aynı
  CLAUDE.md uyarısı çoklu seçim için de geçerliydi).
- Bitiş tarihi geçmişte olamaz (`min` + sunucu tarafı doğrulama).

### Kapsam dışı (şimdilik)

- Otomatik/periyodik indirim (ör. "her hafta sonu %10") — MVP'de tek
  seferlik, elle girilen tek bir aralık yeterli.
- Yüzde bazlı indirim girişi (%30 gibi) — kullanıcı doğrudan indirimli
  TUTARI giriyor, yüzdeyi arayüz hesaplayıp gösterebilir ama veritabanına
  yalnızca tutar yazılır (dugun.com'un kendi `discounted_price` alanı da
  zaten hazır tutar veriyor, örnek: Wedding Palace kaydı).
